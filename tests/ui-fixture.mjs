// Únicamente QA visual, en memoria y loopback. NO es una API de FactuEz.
// No se copia en imágenes Docker. No utiliza credenciales ni datos reales.
import http from "node:http";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
const {
  renderLocalDocumentPdf,
} = require("../packages/pdf-renderer/dist/index.js");
const {
  DefaultRolePermissions,
} = require("../packages/contracts/dist/index.js");
const {
  calculateDocumentTotals,
} = require("../packages/sunat-core/dist/index.js");
if (!process.argv.includes("--visual-only"))
  throw new Error("Debe indicar --visual-only");
const branches = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    companyId: 1,
    code: "QA_CENTRAL",
    name: "QA visual · Central",
    address: "Dirección ficticia para revisar la interfaz",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    companyId: 2,
    code: "QA_NORTE",
    name: "QA visual · Norte",
  },
];
const points = branches.map((branch, i) => ({
  id: `20000000-0000-4000-8000-00000000000${i + 1}`,
  branchId: branch.id,
  companyId: branch.companyId,
  code: `QA_CAJA${i + 1}`,
  name: `Terminal visual ${i + 1}`,
  series: [
    {
      id: `40000000-0000-4000-8000-00000000000${i * 2 + 1}`,
      documentType: "INVOICE",
      series: "F001",
    },
    {
      id: `40000000-0000-4000-8000-00000000000${i * 2 + 2}`,
      documentType: "SALES_RECEIPT",
      series: "B001",
    },
  ],
}));
const catalog = {
  companies: [
    {
      id: 1,
      legalName: "GRIFO SAN JOSE S.R.L. · QA VISUAL",
      ruc: "20450819230",
      environment: "BETA",
    },
    {
      id: 2,
      legalName: "EMISOR FICTICIO · SOLO QA VISUAL",
      ruc: "00000000000",
      environment: "BETA",
    },
  ],
  capabilities: { demoData: true, fiscalTransmission: false },
  branches,
  emissionPoints: points,
  products: [
    {
      id: randomUUID(),
      sku: "QA_DIESEL",
      description: "Diesel B5 · QA visual",
      unitCode: "GLL",
      taxAffectationCode: "10",
      defaultUnitPrice: "18.50",
    },
  ],
};
const users = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    username: "ui.admin",
    fullName: "Administrador · QA visual",
    active: true,
    editable: false,
    roles: [{ code: "ADMIN", name: "Administrador general" }],
    branchIds: [],
    emissionPointIds: [],
    series: [],
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    username: "ui.cashier",
    fullName: "Cajero · QA visual",
    active: true,
    editable: true,
    roles: [{ code: "CASHIER", name: "Cajero" }],
    branchIds: [branches[0].id],
    emissionPointIds: [points[0].id],
    series: points[0].series.map((counter) => counter.id),
  },
];
const documents = [];
const intents = new Map();
const visualSessions = new Map();
const visualIdlePhase = process.argv.find(value => value.startsWith('--idle-phase='))?.split('=')[1] ?? 'active';
if (!['active', 'warning', 'critical'].includes(visualIdlePhase)) throw new Error('Fase visual inválida');
const visualUser = (role) => ({
  sub: users[role === 'ADMIN' ? 0 : 1].id, username: role === 'ADMIN' ? 'ui.admin' : 'ui.cashier',
  fullName: `${role} · QA VISUAL`, roles: [role], permissions: DefaultRolePermissions[role],
  exp: Math.floor(Date.now() / 1000) + 3600,
  scope: role === 'ADMIN' ? { kind: 'GLOBAL' } : { kind: 'ASSIGNED', branchIds: [branches[0].id], emissionPointIds: [points[0].id], series: points[0].series.map(counter => counter.id) },
});
const visualSummary = (record) => ({ idleExpiresAt: record.lastActivityAt + 1800000, serverNow: Date.now(), idleTimeoutSeconds: 1800 });
let uncertainOnce = process.argv.includes("--uncertain-once");
function json(res, value, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}
http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1:3101");
    if (!url.pathname.startsWith("/api/")) {
      const proxy = http.request(
        {
          hostname: "127.0.0.1",
          port: 3100,
          path: req.url,
          method: req.method,
          headers: { ...req.headers, host: "localhost:3100" },
        },
        (reply) => {
          res.writeHead(reply.statusCode ?? 502, reply.headers);
          reply.pipe(res);
        },
      );
      proxy.on("error", () => {
        res.writeHead(502);
        res.end("Inicie primero la vista previa Next.js en 3100");
      });
      req.pipe(proxy);
      return;
    }
    try {
      let text = "";
      for await (const chunk of req) {
        text += chunk;
        if (text.length > 65536) throw new Error("Formulario demasiado grande");
      }
      const body = text ? JSON.parse(text) : undefined;
      if (url.pathname.endsWith('/auth/browser-session/logout')) {
        const key = req.headers.cookie?.match(/(?:^|;\s*)visual_session=([a-z0-9-]+)/)?.[1];
        if (key) visualSessions.delete(key);
        res.setHeader('Set-Cookie', 'visual_session=; Path=/api/v1/auth/browser-session; HttpOnly; SameSite=Strict; Max-Age=0');
        return json(res, { loggedOut: true });
      }
      if (url.pathname === '/api/v1/auth/browser-session' || url.pathname.endsWith('/auth/browser-session/activity')) {
        const key = req.headers.cookie?.match(/(?:^|;\s*)visual_session=([a-z0-9-]+)/)?.[1];
        const record = key && visualSessions.get(key);
        if (!record || Date.now() >= record.lastActivityAt + 1800000) return json(res, { message: 'Sesión visual vencida' }, 401);
        if (url.pathname.endsWith('/activity')) { record.lastActivityAt = Date.now(); return json(res, visualSummary(record)); }
        return json(res, { accessToken: record.username, user: visualUser(record.username === 'ui.admin' ? 'ADMIN' : 'CASHIER'), ...visualSummary(record) });
      }
      if (url.pathname.endsWith("/auth/login") || url.pathname.endsWith('/auth/browser-session/login')) {
        if (
          !["ui.admin", "ui.cashier"].includes(body?.username) ||
          body?.password !== "TEST-VISUAL-ONLY"
        )
          return json(
            res,
            {
              message:
                "QA visual: use ui.admin o ui.cashier con TEST-VISUAL-ONLY",
            },
            401,
          );
        if (url.pathname.endsWith('/browser-session/login')) {
          const elapsed = visualIdlePhase === 'critical' ? 1770000 : visualIdlePhase === 'warning' ? 1500000 : 0;
          const key = randomUUID(); const record = { username: body.username, lastActivityAt: Date.now() - elapsed }; visualSessions.set(key, record);
          res.setHeader('Set-Cookie', `visual_session=${key}; Path=/api/v1/auth/browser-session; HttpOnly; SameSite=Strict; Max-Age=1800`);
          return json(res, { accessToken: body.username, user: visualUser(body.username === 'ui.admin' ? 'ADMIN' : 'CASHIER'), ...visualSummary(record) });
        }
        return json(res, { accessToken: body.username, tokenType: "Bearer" });
      }
      const role =
        req.headers.authorization === "Bearer ui.cashier"
          ? "CASHIER"
          : req.headers.authorization === "Bearer ui.admin"
            ? "ADMIN"
            : undefined;
      if (!role) return json(res, { message: "Sesión QA requerida" }, 401);
      if (url.pathname.endsWith("/auth/me"))
        return json(res, {
          sub: users[role === "ADMIN" ? 0 : 1].id,
          username: role === "ADMIN" ? "ui.admin" : "ui.cashier",
          fullName: `${role} · QA VISUAL`,
          roles: [role],
          permissions: DefaultRolePermissions[role],
          exp: Math.floor(Date.now() / 1000) + 3600,
          scope:
            role === "ADMIN"
              ? { kind: "GLOBAL" }
              : {
                  kind: "ASSIGNED",
                  branchIds: [branches[0].id],
                  emissionPointIds: [points[0].id],
                  series: points[0].series.map((counter) => counter.id),
                },
        });
      if (url.pathname.endsWith("/catalog/issuance"))
        return json(
          res,
          role === "ADMIN"
            ? catalog
            : {
                ...catalog,
                companies: catalog.companies.slice(0, 1),
                branches: branches.slice(0, 1),
                emissionPoints: points.slice(0, 1),
              },
        );
      if (url.pathname.endsWith("/documents/preview"))
        return json(res, calculateDocumentTotals(body.lines));
      if (url.pathname.endsWith("/documents/dashboard"))
        return json(res, {
          date: "2026-10-01",
          updatedAt: new Date().toISOString(),
          currencyCode: "PEN",
          count: 0,
          amount: "0",
          igv: "0",
          states: [],
          types: [],
          points: [],
        });
      const detailId = url.pathname.match(
        /^\/api\/v1\/documents\/([a-f0-9-]{36})$/,
      )?.[1];
      const artifactMatch = url.pathname.match(
        /^\/api\/v1\/fiscal-artifacts\/([a-f0-9-]{36})\/(ticket|a4)$/,
      );
      if (detailId || artifactMatch) {
        const row = documents.find(
          (item) =>
            item.id === (detailId ?? artifactMatch[1]) &&
            (role === "ADMIN" || item.branchId === branches[0].id),
        );
        if (!row)
          return json(
            res,
            { message: "QA: documento no disponible en su alcance" },
            404,
          );
        if (detailId) return json(res, { ...row, fiscalTransmission: false });
        const bytes = await renderLocalDocumentPdf(
          row.immutableSnapshot,
          artifactMatch[2],
        );
        res.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="boleta-QA.pdf"',
          "Cache-Control": "private, no-store",
        });
        return res.end(bytes);
      }
      if (url.pathname === "/api/v1/documents") {
        if (req.method === "POST") {
          const key = `${role}:${req.headers["idempotency-key"]}`;
          if (intents.has(key)) return json(res, intents.get(key), 202);
          const point = points.find(
            (point) => point.id === body.emissionPointId,
          );
          if (!point) throw new Error("Punto visual inválido");
          if (role === "CASHIER" && point.branchId !== branches[0].id)
            return json(res, { message: "Punto QA fuera de alcance" }, 403);
          const company = catalog.companies.find(
            (company) => company.id === point.companyId,
          );
          const row = {
            companyId: point.companyId,
            issuerRuc: company.ruc,
            branchId: point.branchId,
            id: randomUUID(),
            fullNumber: `${body.series}-${documents.filter((doc) => doc.companyId === point.companyId && doc.documentType === body.documentType && doc.fullNumber.startsWith(body.series + "-")).length + 1}`,
            documentType: body.documentType,
            customerLegalName: body.customer.legalName,
            payableAmount: calculateDocumentTotals(body.lines).totals
              .payableAmount,
            currencyCode: "PEN",
            sunatStatus: "QUEUED",
            issueDate: new Date().toISOString(),
            branchName: branches.find((branch) => branch.id === point.branchId)
              .name,
          };
          row.immutableSnapshot = {
            documentId: row.id,
            companyId: row.companyId,
            branchId: row.branchId,
            environment: "BETA",
            documentTypeCode: row.documentType === "INVOICE" ? "01" : "03",
            series: body.series,
            number: row.fullNumber.split("-")[1],
            fullNumber: row.fullNumber,
            issueDate: row.issueDate,
            currencyCode: row.currencyCode,
            operationTypeCode: "0101",
            issuer: {
              identityType: "6",
              identityNumber: company.ruc,
              legalName: company.legalName,
              address: "Dirección FICTICIA de QA visual",
              ubigeo: "200101",
              establishmentCode: "QA",
            },
            customer: body.customer,
            ...calculateDocumentTotals(body.lines),
          };
          documents.unshift(row);
          const result = {
            documentId: row.id,
            companyId: row.companyId,
            issuerRuc: row.issuerRuc,
            fullNumber: row.fullNumber,
            sunatStatus: row.sunatStatus,
          };
          intents.set(key, result);
          if (uncertainOnce) {
            uncertainOnce = false;
            return json(
              res,
              {
                message:
                  "QA visual: respuesta incierta simulada después del registro. Reintente la misma operación.",
              },
              503,
            );
          }
          return json(res, result, 202);
        }
        const rows = documents.filter(
          (doc) =>
            (!url.searchParams.get("companyId") ||
              String(doc.companyId) === url.searchParams.get("companyId")) &&
            (!url.searchParams.get("branchId") ||
              doc.branchId === url.searchParams.get("branchId")) &&
            (role === "ADMIN" || doc.branchId === branches[0].id),
        );
        return json(res, {
          page: 1,
          pageSize: 20,
          total: rows.length,
          items: rows,
        });
      }
      if (
        url.pathname === "/api/v1/stations/issuers" &&
        req.method === "POST"
      ) {
        if (role !== "ADMIN")
          return json(res, { message: "QA: requiere ADMIN" }, 403);
        const company = {
          id: catalog.companies.length + 1,
          ruc: body.ruc,
          legalName: body.legalName,
          environment: "BETA",
        };
        catalog.companies.push(company);
        return json(res, company, 201);
      }
      if (url.pathname === "/api/v1/stations" && req.method === "POST") {
        if (role !== "ADMIN")
          return json(res, { message: "QA: requiere ADMIN" }, 403);
        const branch = { id: randomUUID(), ...body };
        branches.push(branch);
        return json(res, branch, 201);
      }
      if (
        /\/stations\/[^/]+\/issuer$/.test(url.pathname) &&
        req.method === "PATCH"
      ) {
        const branch = branches.find(
          (branch) => branch.id === url.pathname.split("/")[4],
        );
        if (!branch) throw new Error("Sede QA no encontrada");
        if (points.some((point) => point.branchId === branch.id))
          return json(
            res,
            { message: "QA: sede con puntos; reasignación bloqueada" },
            409,
          );
        branch.companyId = body.companyId;
        return json(res, branch);
      }
      if (url.pathname === "/api/v1/roles")
        return json(
          res,
          Object.entries(DefaultRolePermissions).map(([code, permissions]) => ({
            id: code,
            code,
            name: code,
            description: "QA visual",
            permissions,
            assignable: true,
          })),
        );
      if (url.pathname === "/api/v1/users") {
        if (req.method === "POST") {
          const { password: _password, roles, ...values } = body;
          const row = {
            ...values,
            id: randomUUID(),
            editable: true,
            active: true,
            roles: roles.map((code) => ({ code, name: code })),
          };
          users.push(row);
          return json(res, row, 201);
        }
        return json(res, users);
      }
      if (/\/users\/[^/]+\/access$/.test(url.pathname)) {
        const user = users.find(
          (item) => item.id === url.pathname.split("/")[4],
        );
        if (!user)
          return json(res, { message: "Usuario visual no encontrado" }, 404);
        Object.assign(user, body, {
          roles:
            body.roles?.map((code) => ({ code, name: code })) ?? user.roles,
        });
        return json(res, user);
      }
      return json(
        res,
        { message: "Esta acción no forma parte del fixture visual" },
        404,
      );
    } catch (error) {
      json(res, { message: error.message }, 400);
    }
  })
  .listen(3101, "127.0.0.1", () =>
    console.log(
      "QA visual temporal: http://localhost:3101 · Datos ficticios en memoria; no valida backend real.",
    ),
  );
