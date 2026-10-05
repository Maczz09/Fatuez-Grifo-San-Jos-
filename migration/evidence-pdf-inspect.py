"""Fixed read-only metadata helper: PDF bytes on stdin, bounded JSON on stdout.

No PDF paths, network, subprocesses, output files or PDF authoring. Fail closed on
active features, object/xref streams, unsupported filters, rotation and crop boxes.
Classic PDFKit/reportlab documents with Flate/DCT streams are supported.
"""
import base64
import io
import json
import logging
import math
import re
import sys
import warnings
import zlib

MAX_INPUT = 4 * 1024 * 1024
MAX_PAGES = 10
MAX_OBJECTS = 20000
MAX_NODES = 100000
MAX_STREAM = 8 * 1024 * 1024
MAX_STREAM_TOTAL = 32 * 1024 * 1024
MAX_TEXT_CHARS = 200000
MAX_TEXT_LINES = 2000
MAX_LINE = 1000
MAX_PIXELS = 8000000
MAX_TOTAL_PIXELS = 32000000
MAX_SIDE = 8192
DPI = 144
BLOCKED_NAMES = frozenset((
    b"Encrypt", b"JavaScript", b"JS", b"EmbeddedFiles", b"EmbeddedFile",
    b"OpenAction", b"AA", b"Launch", b"XFA", b"URI", b"GoToR", b"GoToE",
    b"SubmitForm", b"ImportData", b"Rendition", b"Movie", b"Sound", b"RichMedia",
    b"FileAttachment", b"Filespec", b"AcroForm", b"A", b"F", b"FFilter",
    b"FDecodeParms", b"ObjStm", b"XRef", b"PS", b"PostScript", b"3D",
    b"GoTo", b"Hide", b"ResetForm", b"SetOCGState", b"Thread", b"Action",
))


class Blocked(Exception):
    def __init__(self, code):
        self.code = code


def require(ok, code):
    if not ok:
        raise Blocked(code)


def lexical_check(data):
    # Includes escaped PDF names and unreachable objects; conservative by design.
    # Binary stream contents are not PDF dictionaries. Scanning them as names would
    # falsely classify compressed images. The parsed object graph is checked too.
    outside_streams = re.sub(rb"\bstream(?:\r\n|\n|\r).*?\bendstream\b", b"\n", data, flags=re.DOTALL)
    for match in re.finditer(rb"/([^\x00\t\n\x0c\r ()<>\[\]{}/%]+)", outside_streams):
        name = re.sub(rb"#([0-9a-fA-F]{2})", lambda m: bytes([int(m[1], 16)]), match[1])
        require(name not in BLOCKED_NAMES, "PDF_ACTIVE_FEATURE_BLOCKED" if name not in (b"ObjStm", b"XRef") else "PDF_OBJECT_STREAM_BLOCKED")


def inspect(data, format_name):
    require(0 < len(data) <= MAX_INPUT, "PDF_INPUT_LIMIT")
    require(re.match(rb"%PDF-1\.[0-7](?:\r|\n)", data) is not None, "PDF_INVALID")
    lexical_check(data)
    # Available on POSIX; Windows process timeout and all logical limits also apply.
    if sys.platform != "win32":
        import resource
        resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
    from pypdf import PdfReader
    from pypdf.generic import ArrayObject, DictionaryObject, IndirectObject, NameObject, StreamObject
    reader = PdfReader(io.BytesIO(data), strict=True)
    require(not reader.is_encrypted, "PDF_ENCRYPTED_BLOCKED")
    require(not reader.xref_objStm, "PDF_OBJECT_STREAM_BLOCKED")
    refs = [(generation, number) for generation, values in reader.xref.items() for number in values if number]
    require(len(refs) <= MAX_OBJECTS, "PDF_OBJECT_LIMIT")
    seen_refs = set()
    nodes = 0
    stream_total = 0

    def visit(obj, depth=0):
        nonlocal nodes, stream_total
        nodes += 1
        require(nodes <= MAX_NODES and depth <= 64, "PDF_OBJECT_LIMIT")
        if isinstance(obj, IndirectObject):
            identity = (obj.generation, obj.idnum)
            if identity in seen_refs:
                return
            seen_refs.add(identity)
            visit(obj.get_object(), depth + 1)
            return
        if isinstance(obj, NameObject):
            require(str(obj).lstrip("/").encode("utf-8") not in BLOCKED_NAMES, "PDF_ACTIVE_FEATURE_BLOCKED")
        if isinstance(obj, DictionaryObject):
            for key, value in obj.items():
                require(str(key).lstrip("/").encode("utf-8") not in BLOCKED_NAMES, "PDF_ACTIVE_FEATURE_BLOCKED")
                visit(value, depth + 1)
            if isinstance(obj, StreamObject):
                raw = obj._data
                require(isinstance(raw, bytes) and len(raw) <= MAX_STREAM, "PDF_STREAM_LIMIT")
                filters = obj.get("/Filter", [])
                filters = [filters] if not isinstance(filters, (list, ArrayObject)) else filters
                require(len(filters) <= 2, "PDF_FILTER_BLOCKED")
                decoded = raw
                for filter_name in filters:
                    if filter_name == "/FlateDecode":
                        inflater = zlib.decompressobj()
                        decoded = inflater.decompress(decoded, MAX_STREAM + 1)
                        require(len(decoded) <= MAX_STREAM and not inflater.unconsumed_tail and inflater.eof and
                                not inflater.unused_data, "PDF_STREAM_LIMIT")
                    elif filter_name == "/ASCII85Decode":
                        decoded = base64.a85decode(decoded, adobe=True)
                    elif filter_name == "/DCTDecode":
                        require(obj.get("/Subtype") == "/Image" and len(filters) == 1, "PDF_FILTER_BLOCKED")
                    else:
                        raise Blocked("PDF_FILTER_BLOCKED")
                    require(len(decoded) <= MAX_STREAM, "PDF_STREAM_LIMIT")
                stream_total += len(decoded)
                require(stream_total <= MAX_STREAM_TOTAL, "PDF_STREAM_LIMIT")
                if obj.get("/Subtype") == "/Image":
                    width, height = obj.get("/Width"), obj.get("/Height")
                    require(isinstance(width, int) and isinstance(height, int) and 0 < width <= MAX_SIDE and
                            0 < height <= MAX_SIDE and width * height <= MAX_PIXELS, "PDF_IMAGE_LIMIT")
        elif isinstance(obj, (ArrayObject, list)):
            require(len(obj) <= MAX_OBJECTS, "PDF_OBJECT_LIMIT")
            for value in obj:
                visit(value, depth + 1)

    visit(reader.trailer)
    # Check every object, including ones unreachable from the page/catalog tree.
    for generation, number in refs:
        visit(IndirectObject(number, generation, reader))
    page_count = len(reader.pages)
    require(0 < page_count <= MAX_PAGES, "PDF_PAGE_LIMIT")
    sizes = []
    pixels = 0
    for page in reader.pages:
        require(int(page.get("/Rotate", 0)) == 0 and float(page.get("/UserUnit", 1)) == 1, "PDF_GEOMETRY_BLOCKED")
        box = [float(v) for v in page.mediabox]
        require(all(math.isfinite(v) for v in box) and box[0] == 0 and box[1] == 0 and
                list(page.cropbox) == list(page.mediabox), "PDF_GEOMETRY_BLOCKED")
        width, height = round((box[2] - box[0]) * 25400 / 72), round((box[3] - box[1]) * 25400 / 72)
        require(width > 0 and height > 0, "PDF_GEOMETRY_BLOCKED")
        require(abs(width - 80000) <= 30 if format_name == "ticket" else
                abs(width - 210000) <= 30 and abs(height - 297000) <= 30, "PDF_FORMAT_MISMATCH")
        rw, rh = math.ceil(width * DPI / 25400), math.ceil(height * DPI / 25400)
        require(rw <= MAX_SIDE and rh <= MAX_SIDE and rw * rh <= MAX_PIXELS, "PDF_PAGE_LIMIT")
        pixels += rw * rh
        require(pixels <= MAX_TOTAL_PIXELS, "PDF_PAGE_LIMIT")
        sizes.append({"width": width, "height": height})
    lines = []
    text_chars = 0
    for page in reader.pages:
        text = page.extract_text() or ""
        text_chars += len(text)
        require(text_chars <= MAX_TEXT_CHARS and not re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", text), "PDF_TEXT_LIMIT")
        for line in text.splitlines():
            require(len(line) <= MAX_LINE and len(lines) < MAX_TEXT_LINES, "PDF_TEXT_LIMIT")
            lines.append(line)
    return {"schemaVersion": "factuez.synthetic-pdf-metadata.v1", "format": format_name,
            "pageSizesMicrometers": sizes, "textLines": lines}


def main():
    # No file argument, configurable module, subprocess command or arbitrary code.
    try:
        logging.getLogger("pypdf").setLevel(logging.CRITICAL)
        warnings.simplefilter("ignore")
        require(len(sys.argv) == 3 and sys.argv[1] == "--format" and sys.argv[2] in ("ticket", "a4"), "PDF_ARGUMENTS_BLOCKED")
        data = sys.stdin.buffer.read(MAX_INPUT + 1)
        result = inspect(data, sys.argv[2])
    except Blocked as error:
        result = {"error": error.code}
    except Exception:
        result = {"error": "PDF_INVALID"}
    # No parser diagnostics, local paths, document contents or tracebacks on errors.
    sys.stdout.write(json.dumps(result, ensure_ascii=True, separators=(",", ":")))


if __name__ == "__main__":
    main()
