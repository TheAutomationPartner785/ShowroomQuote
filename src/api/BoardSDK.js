/**
 * BoardSDK — réplica del SDK auto-generado de Monday Vibe.
 *
 * Expone EXACTAMENTE la misma API fluida que usa la app
 * (LeadsEndCustomersBoard, ProductCatalogBoard, AccountsBoard, ContactsBoard),
 * pero por dentro arma GraphQL estándar de Monday y lo manda por el Cloudflare
 * Worker (el token nunca toca el navegador).
 *
 * Mapeo alias -> columna real verificado contra los tableros en producción.
 * Ojo: en Product Catalog la columna con id literal "status" es BRAND, y el
 * estado del producto es "color_mkqkprx1" (confirmado en vivo).
 */
import { mondayApi } from './monday-client.js';

// ───────────────────────────────────────────────────────────────────────────
// Selección de column_values reutilizable (con fragmentos tipados)
// ───────────────────────────────────────────────────────────────────────────
const cvSelection = (idsVar) => `column_values(ids: ${idsVar}) {
        id
        type
        text
        value
        ... on BoardRelationValue { linked_item_ids linked_items { id name } }
        ... on MirrorValue { display_value }
      }`;

// ───────────────────────────────────────────────────────────────────────────
// Parseo de un column_value crudo -> valor "amigable" según el tipo
// ───────────────────────────────────────────────────────────────────────────
function parseValue(cv, def) {
  if (!cv) return null;
  switch (def.type) {
    case 'email':
      return cv.text ? { email: cv.text, text: cv.text } : null;
    case 'numbers':
      return cv.text === '' || cv.text == null ? null : Number(cv.text);
    case 'status':
      return cv.text || null;
    case 'date':
      return cv.text || null;
    case 'board_relation':
      return {
        linkedItems: (cv.linked_items || []).map((li) => ({
          id: String(li.id),
          name: li.name,
        })),
      };
    case 'mirror':
      return cv.display_value ?? null;
    case 'text':
    case 'long_text':
    default:
      return cv.text || null;
  }
}

// Construye el objeto amigable de un item a partir de la respuesta cruda
function parseItem(raw, requestedAliases, columns) {
  const obj = { id: String(raw.id), name: raw.name };
  const byId = {};
  (raw.column_values || []).forEach((cv) => {
    byId[cv.id] = cv;
  });
  for (const alias of requestedAliases) {
    const def = columns[alias];
    if (!def || def.id === 'name') continue;
    obj[alias] = parseValue(byId[def.id], def);
  }
  return obj;
}

// ───────────────────────────────────────────────────────────────────────────
// Formateo de valores para escritura (create / update)
// ───────────────────────────────────────────────────────────────────────────
function fmtDate(v) {
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return {};
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 19) };
}

function formatWriteValue(def, val) {
  switch (def.type) {
    case 'email':
      return { email: val.email, text: val.label || val.text || val.email };
    case 'long_text':
      return { text: String(val ?? '') };
    case 'numbers':
      return String(val);
    case 'status':
      return { label: String(val) };
    case 'date':
      return fmtDate(val);
    case 'board_relation':
      return { item_ids: (val.linkedItems || []).map((li) => Number(li.id) || li.id) };
    case 'text':
    default:
      return String(val ?? '');
  }
}

// payload amigable -> objeto column_values (real ids). Para updates, "name" se
// escribe como columna especial; para creates va aparte como item_name.
function buildColumnValues(payload, columns, { asUpdate = false } = {}) {
  const cv = {};
  for (const [alias, val] of Object.entries(payload)) {
    if (alias === 'name') {
      if (asUpdate) cv['name'] = String(val);
      continue;
    }
    if (val === undefined) continue;
    const def = columns[alias];
    if (!def) {
      console.warn('[BoardSDK] alias desconocido al escribir:', alias);
      continue;
    }
    cv[def.id] = formatWriteValue(def, val);
  }
  return cv;
}

// Pequeño wrapper para encadenar .execute()
class Mutation {
  constructor(fn) {
    this._fn = fn;
  }
  execute() {
    return this._fn();
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Builder de consultas de lista: board.items()
// ───────────────────────────────────────────────────────────────────────────
class ItemsQueryBuilder {
  constructor(board) {
    this.board = board;
    this._columns = [];
    this._where = {};
    this._orderBy = null;
    this._limit = 25;
    this._cursor = null;
  }
  withColumns(aliases) {
    this._columns = aliases || [];
    return this;
  }
  where(conditions) {
    this._where = { ...this._where, ...conditions };
    return this;
  }
  orderBy(spec) {
    this._orderBy = spec;
    return this;
  }
  withPagination({ limit, cursor } = {}) {
    if (cursor) this._cursor = cursor;
    if (limit) this._limit = limit;
    return this;
  }

  _colIds() {
    return this._columns
      .map((a) => this.board.columns[a]?.id)
      .filter((id) => id && id !== 'name');
  }

  _queryParams() {
    const rules = [];
    for (const [key, val] of Object.entries(this._where)) {
      if (key === 'group') continue;
      const def = this.board.columns[key];
      if (!def) continue;
      const values = Array.isArray(val) ? val : [val];
      if (def.type === 'status') {
        const indices = values
          .map((label) => def.indexByLabel?.[label])
          .filter((i) => i !== undefined && i !== null);
        rules.push({ column_id: def.id, compare_value: indices, operator: 'any_of' });
      } else {
        rules.push({ column_id: def.id, compare_value: values, operator: 'any_of' });
      }
    }
    const qp = {};
    if (rules.length) qp.rules = rules;
    if (this._orderBy) {
      const def = this.board.columns[this._orderBy.column] || { id: this._orderBy.column };
      qp.order_by = [{ column_id: def.id, direction: this._orderBy.direction || 'asc' }];
    }
    return Object.keys(qp).length ? qp : null;
  }

  async execute() {
    const ids = this._colIds();
    const hasIds = ids.length > 0;
    // Si no se pidieron columnas, omitimos column_values (con [] Monday devuelve
    // TODAS las columnas del board, que es un desperdicio).
    const idsDecl = hasIds ? '$ids: [String!], ' : '';
    const itemFields = hasIds ? `id name ${cvSelection('$ids')}` : 'id name';
    const parse = (rawItems) =>
      (rawItems || []).map((it) => parseItem(it, this._columns, this.board.columns));

    // Continuación por cursor (sirve tanto para listado normal como por grupo)
    if (this._cursor) {
      const query = `query (${idsDecl}$cursor: String!, $limit: Int!) {
        next_items_page(cursor: $cursor, limit: $limit) {
          cursor
          items { ${itemFields} }
        }
      }`;
      const variables = { cursor: this._cursor, limit: this._limit };
      if (hasIds) variables.ids = ids;
      const data = await mondayApi(query, variables);
      const page = data.next_items_page;
      return { items: parse(page?.items), cursor: page?.cursor || null };
    }

    // Filtro por grupo (primera página)
    const groupIds = this._where.group;
    if (groupIds && groupIds.length) {
      const groupsArg = JSON.stringify(groupIds);
      const query = `query (${idsDecl}$limit: Int!) {
        boards(ids: [${this.board.boardId}]) {
          groups(ids: ${groupsArg}) {
            items_page(limit: $limit) {
              cursor
              items { ${itemFields} }
            }
          }
        }
      }`;
      const variables = { limit: this._limit };
      if (hasIds) variables.ids = ids;
      const data = await mondayApi(query, variables);
      const groups = data.boards?.[0]?.groups || [];
      const items = groups.flatMap((g) => g.items_page?.items || []);
      const cursor = groups[0]?.items_page?.cursor || null;
      return { items: parse(items), cursor };
    }

    // Listado normal (primera página) con query_params opcional
    const qp = this._queryParams();
    const qpArg = qp ? ', query_params: $qp' : '';
    const qpDecl = qp ? ', $qp: ItemsQuery' : '';
    const query = `query (${idsDecl}$limit: Int!${qpDecl}) {
      boards(ids: [${this.board.boardId}]) {
        items_page(limit: $limit${qpArg}) {
          cursor
          items { ${itemFields} }
        }
      }
    }`;
    const variables = { limit: this._limit };
    if (hasIds) variables.ids = ids;
    if (qp) variables.qp = qp;
    const data = await mondayApi(query, variables);
    const page = data.boards?.[0]?.items_page;
    return { items: parse(page?.items), cursor: page?.cursor || null };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Builder de subitems: board.item(parentId).subitem(subId?)
// ───────────────────────────────────────────────────────────────────────────
class SubitemBuilder {
  constructor(board, parentId, subId) {
    this.board = board;
    this.parentId = parentId;
    this.subId = subId;
  }
  create(payload) {
    return new Mutation(async () => {
      const cv = buildColumnValues(payload, this.board.subitemColumns);
      const query = `mutation ($name: String!, $cv: JSON!, $pid: ID!) {
        create_subitem(parent_item_id: $pid, item_name: $name, column_values: $cv) { id }
      }`;
      const data = await mondayApi(query, {
        name: String(payload.name ?? ''),
        cv: JSON.stringify(cv),
        pid: this.parentId,
      });
      return { id: String(data.create_subitem.id) };
    });
  }
  update(payload) {
    return new Mutation(async () => {
      const cv = buildColumnValues(payload, this.board.subitemColumns, { asUpdate: true });
      const query = `mutation ($cv: JSON!, $itemId: ID!) {
        change_multiple_column_values(board_id: ${this.board.subitemBoardId}, item_id: $itemId, column_values: $cv) { id }
      }`;
      const data = await mondayApi(query, { cv: JSON.stringify(cv), itemId: this.subId });
      return { id: String(data.change_multiple_column_values.id) };
    });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Builder de item: board.item(id?)
// ───────────────────────────────────────────────────────────────────────────
class ItemBuilder {
  constructor(board, id) {
    this.board = board;
    this.id = id;
    this._columns = [];
    this._subColumns = null;
  }
  withColumns(aliases) {
    this._columns = aliases || [];
    return this;
  }
  withSubItems(aliases) {
    this._subColumns = aliases || [];
    return this;
  }

  async execute() {
    const ids = this._columns
      .map((a) => this.board.columns[a]?.id)
      .filter((id) => id && id !== 'name');
    const hasIds = ids.length > 0;

    let subBlock = '';
    let subIds = [];
    let hasSubIds = false;
    if (this._subColumns) {
      subIds = this._subColumns
        .map((a) => this.board.subitemColumns[a]?.id)
        .filter((id) => id && id !== 'name');
      hasSubIds = subIds.length > 0;
      subBlock = hasSubIds
        ? `subitems { id name ${cvSelection('$subIds')} }`
        : `subitems { id name }`;
    }

    const declParts = [];
    if (hasIds) declParts.push('$ids: [String!]');
    if (hasSubIds) declParts.push('$subIds: [String!]');
    const decl = declParts.length ? `(${declParts.join(', ')})` : '';
    const colBlock = hasIds ? cvSelection('$ids') : '';

    const query = `query ${decl} {
      items(ids: [${this.id}]) {
        id
        name
        ${colBlock}
        ${subBlock}
      }
    }`;
    const variables = {};
    if (hasIds) variables.ids = ids;
    if (hasSubIds) variables.subIds = subIds;

    const data = await mondayApi(query, variables);
    const raw = data.items?.[0];
    if (!raw) return null;

    const obj = parseItem(raw, this._columns, this.board.columns);
    if (this._subColumns) {
      obj.subitems = (raw.subitems || []).map((s) =>
        parseItem(s, this._subColumns, this.board.subitemColumns)
      );
    }
    return obj;
  }

  create(payload) {
    return new Mutation(async () => {
      const cv = buildColumnValues(payload, this.board.columns);
      const query = `mutation ($name: String!, $cv: JSON!) {
        create_item(board_id: ${this.board.boardId}, item_name: $name, column_values: $cv) { id name }
      }`;
      const data = await mondayApi(query, {
        name: String(payload.name ?? ''),
        cv: JSON.stringify(cv),
      });
      return { ...payload, id: String(data.create_item.id) };
    });
  }

  update(payload) {
    return new Mutation(async () => {
      const cv = buildColumnValues(payload, this.board.columns, { asUpdate: true });
      const query = `mutation ($cv: JSON!, $itemId: ID!) {
        change_multiple_column_values(board_id: ${this.board.boardId}, item_id: $itemId, column_values: $cv) { id }
      }`;
      const data = await mondayApi(query, { cv: JSON.stringify(cv), itemId: this.id });
      return { id: String(data.change_multiple_column_values.id) };
    });
  }

  archive() {
    return new Mutation(async () => {
      const query = `mutation ($itemId: ID!) { archive_item(item_id: $itemId) { id } }`;
      const data = await mondayApi(query, { itemId: this.id });
      return { id: String(data.archive_item.id) };
    });
  }

  subitem(subId) {
    return new SubitemBuilder(this.board, this.id, subId);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Clase base de board
// ───────────────────────────────────────────────────────────────────────────
class BoardSDK {
  constructor(config) {
    this.boardId = config.boardId;
    this.subitemBoardId = config.subitemBoardId || null;
    this.columns = config.columns;
    this.subitemColumns = config.subitemColumns || {};
  }
  items() {
    return new ItemsQueryBuilder(this);
  }
  item(id) {
    return new ItemBuilder(this, id);
  }
  get users() {
    return {
      me: () => ({
        execute: async () => {
          const data = await mondayApi(`query { me { id name email } }`);
          return data.me;
        },
      }),
    };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Definición de cada board (alias -> { id, type } verificado en producción)
// ───────────────────────────────────────────────────────────────────────────
const LEAD_STATUS_INDEX = {
  'Engaged (No Quote)': 0,
  'Appointment Booked': 1,
  'New Lead / Needs review': 2,
  'Cold Lead': 3,
  Quoted: 4,
  'Appointment Cancelled (in Advance)': 6,
  'Consultation Invited': 7,
  Won: 8,
  'No Show': 9,
  Lost: 11,
  'Duplicate Lead (Ignore)': 12,
  'Delayed / Follow Up': 13,
};

const ACCOUNT_STATUS_INDEX = {
  Active: 0,
  'In Review': 1,
  Prospect: 4,
  Inactive: 13,
};

export class LeadsEndCustomersBoard extends BoardSDK {
  constructor() {
    super({
      boardId: 9074819963,
      subitemBoardId: 9074819997,
      columns: {
        name: { id: 'name', type: 'name' },
        email: { id: 'lead_email', type: 'email' },
        zipCode: { id: 'text_mkrdhkar', type: 'text' },
        referOutDealer: { id: 'board_relation_mkr4nf1m', type: 'board_relation' },
        comments: { id: 'long_text_mm2nnx8e', type: 'long_text' },
        quotedDate: { id: 'date_mkrchczx', type: 'date' },
        showroomVisitDate: { id: 'date_mkr69hg3', type: 'date' },
        leadStatus: { id: 'lead_status', type: 'status', indexByLabel: LEAD_STATUS_INDEX },
        quoteStatus: { id: 'color_mkrbabe0', type: 'status' },
        customerContact: { id: 'board_relation_mkqrjazr', type: 'board_relation' },
      },
      subitemColumns: {
        name: { id: 'name', type: 'name' },
        column20ProductCatalog: { id: 'board_relation_mkrattp3', type: 'board_relation' },
        qty: { id: 'numeric_mkrbf7vn', type: 'numbers' },
        includeexclude: { id: 'color_mkt6dj5t', type: 'status' },
        msrpCa1: { id: 'numeric_mkrjg3tg', type: 'numbers' },
        totalPrice: { id: 'numeric_mkrcjkg', type: 'numbers' },
        msrpCa: { id: 'lookup_mkrb9vph', type: 'mirror' },
      },
    });
  }
}

export class AccountsBoard extends BoardSDK {
  constructor() {
    super({
      boardId: 9074823630,
      columns: {
        name: { id: 'name', type: 'name' },
        accountStatus: { id: 'status', type: 'status', indexByLabel: ACCOUNT_STATUS_INDEX },
        accountType: { id: 'color_mkppr6bk', type: 'status' },
      },
    });
  }
}

export class ProductCatalogBoard extends BoardSDK {
  constructor() {
    super({
      boardId: 9229297776,
      columns: {
        name: { id: 'name', type: 'name' },
        // OJO: "status" (product status) -> color_mkqkprx1 ; "brand" -> id literal "status"
        status: { id: 'color_mkqkprx1', type: 'status' },
        brand: { id: 'status', type: 'status' },
        productType: { id: 'color_mkqkc4j4', type: 'status' },
        productFamily: { id: 'color_mkszsyat', type: 'status' },
        productCategory: { id: 'text_mkr5pg7q', type: 'text' },
        productDescription: { id: 'text_mkqkzyrc', type: 'text' },
        friendlyDescription: { id: 'text_mm0vktnr', type: 'text' },
        msrpCa: { id: 'numeric_mkqkbs8a', type: 'numbers' },
      },
    });
  }
}

export class ContactsBoard extends BoardSDK {
  constructor() {
    super({
      boardId: 9074823021,
      columns: {
        name: { id: 'name', type: 'name' },
      },
    });
  }
}
