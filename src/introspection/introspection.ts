import { cloneDeep, each, get, isEmpty, keyBy, map, omitBy, pickBy, reject, chain } from 'lodash';
import {
  buildClientSchema,
  introspectionFromSchema,
  lexicographicSortSchema,
  IntrospectionSchema,
  IntrospectionType,
} from 'graphql';
import { SimplifiedIntrospection, SimplifiedIntrospectionWithIds, SimplifiedType } from './types';
import { typeNameToId } from './utils';

export const FAKE_ROOT_ID = 'FAKE_ROOT_INTERNAL___';

function unwrapType(type, wrappers) {
  while (type.kind === 'NON_NULL' || type.kind == 'LIST') {
    wrappers.push(type.kind);
    type = type.ofType;
  }

  return type.name;
}

function convertArg(inArg) {
  var outArg = <any>{
    name: inArg.name,
    description: inArg.description,
    defaultValue: inArg.defaultValue,
    typeWrappers: [],
  };
  outArg.type = unwrapType(inArg.type, outArg.typeWrappers);

  return outArg;
}

let convertInputField = convertArg;

function convertField(inField) {
  var outField = <any>{
    name: inField.name,
    description: inField.description,
    typeWrappers: [],
    isDeprecated: inField.isDeprecated,
  };

  outField.type = unwrapType(inField.type, outField.typeWrappers);

  outField.args = chain(inField.args).map(convertArg).keyBy('name').value();

  if (outField.isDeprecated) outField.deprecationReason = inField.deprecationReason;

  return outField;
}

function convertType(inType: IntrospectionType): SimplifiedType {
  const outType: SimplifiedType = {
    kind: inType.kind,
    name: inType.name,
    description: inType.description,
  };

  switch (inType.kind) {
    case 'OBJECT':
      outType.interfaces = chain(inType.interfaces).map('name').uniq().value();
      outType.fields = chain(inType.fields).map(convertField).keyBy('name').value();
      break;
    case 'INTERFACE':
      outType.derivedTypes = chain(inType.possibleTypes).map('name').uniq().value();
      outType.fields = chain(inType.fields).map(convertField).keyBy('name').value();
      break;
    case 'UNION':
      outType.possibleTypes = chain(inType.possibleTypes).map('name').uniq().value();
      break;
    case 'ENUM':
      outType.enumValues = inType.enumValues.slice();
      break;
    case 'INPUT_OBJECT':
      outType.inputFields = chain(inType.inputFields).map(convertInputField).keyBy('name').value();
      break;
  }

  return outType;
}

function simplifySchema(inSchema: IntrospectionSchema): SimplifiedIntrospection {
  return {
    types: chain(inSchema.types).map(convertType).keyBy('name').value(),
    queryType: inSchema.queryType.name,
    mutationType: get(inSchema, 'mutationType.name', null),
    subscriptionType: get(inSchema, 'subscriptionType.name', null),
    //FIXME:
    //directives:
  };
}

function markRelayTypes(schema: SimplifiedIntrospectionWithIds): void {
  const nodeType = schema.types[typeNameToId('Node')];
  if (nodeType) nodeType.isRelayType = true;

  const pageInfoType = schema.types[typeNameToId('PageInfo')];
  if (pageInfoType) pageInfoType.isRelayType = true;

  const edgeTypesMap = {};

  each(schema.types, type => {
    if (!isEmpty(type.interfaces)) {
      type.interfaces = reject(type.interfaces, baseType => baseType.type.name === 'Node');
    }

    each(type.fields, field => {
      const connectionType = field.type;
      if (
        !/.Connection$/.test(connectionType.name) ||
        connectionType.kind !== 'OBJECT' ||
        !connectionType.fields.edges
      ) {
        return;
      }

      const edgesType = connectionType.fields.edges.type;
      if (edgesType.kind !== 'OBJECT' || !edgesType.fields.node) {
        return;
      }

      const nodeType = edgesType.fields.node.type;

      connectionType.isRelayType = true;
      edgesType.isRelayType = true;

      edgeTypesMap[edgesType.name] = nodeType;

      field.relayType = field.type;
      field.type = nodeType;
      field.typeWrappers = ['LIST'];

      const relayArgNames = ['first', 'last', 'before', 'after'];
      const isRelayArg = arg => relayArgNames.includes(arg.name);
      field.relayArgs = pickBy(field.args, isRelayArg);
      field.args = omitBy(field.args, isRelayArg);
    });
  });

  each(schema.types, type => {
    each(type.fields, field => {
      var realType = edgeTypesMap[field.type.name];
      if (realType === undefined) return;

      field.relayType = field.type;
      field.type = realType;
    });
  });

  const { queryType } = schema;
  let query = schema.types[queryType.id];

  if (get(query, 'fields.node.type.isRelayType')) {
    delete query.fields['node'];
  }

  //GitHub use `nodes` instead of `node`.
  if (get(query, 'fields.nodes.type.isRelayType')) {
    delete query.fields['nodes'];
  }

  if (get(query, 'fields.relay.type') === queryType) {
    delete query.fields['relay'];
  }
}

function markDeprecated(schema: SimplifiedIntrospectionWithIds): void {
  // Remove deprecated fields.
  each(schema.types, type => {
    type.fields = pickBy(type.fields, field => !field.isDeprecated);
  });

  // We can't remove types that end up being empty
  // because we cannot be sure that the @deprecated directives where
  // consistently added to the schema we're handling.
  //
  // Entities may have non deprecated fields pointing towards entities
  // which are deprecated.
}

function assignTypesAndIDs(schema: SimplifiedIntrospection) {
  (<any>schema).queryType = schema.types[schema.queryType];
  (<any>schema).mutationType = schema.types[schema.mutationType];
  (<any>schema).subscriptionType = schema.types[schema.subscriptionType];
  each(schema.types, (type: any) => {
    type.id = typeNameToId(type.name);

    each(type.inputFields, (field: any) => {
      field.id = `FIELD::${type.name}::${field.name}`;
      field.type = schema.types[field.type];
    });

    each(type.fields, (field: any) => {
      field.id = `FIELD::${type.name}::${field.name}`;
      field.type = schema.types[field.type];
      each(field.args, (arg: any) => {
        arg.id = `ARGUMENT::${type.name}::${field.name}::${arg.name}`;
        arg.type = schema.types[arg.type];
      });
    });

    if (!isEmpty(type.possibleTypes)) {
      type.possibleTypes = map(type.possibleTypes, (possibleType: string) => ({
        id: `POSSIBLE_TYPE::${type.name}::${possibleType}`,
        type: schema.types[possibleType],
      }));
    }

    if (!isEmpty(type.derivedTypes)) {
      type.derivedTypes = map(type.derivedTypes, (derivedType: string) => ({
        id: `DERIVED_TYPE::${type.name}::${derivedType}`,
        type: schema.types[derivedType],
      }));
    }

    if (!isEmpty(type.interfaces)) {
      type.interfaces = map(type.interfaces, (baseType: string) => ({
        id: `INTERFACE::${type.name}::${baseType}`,
        type: schema.types[baseType],
      }));
    }
  });

  schema.types = keyBy(schema.types, 'id');
}

export function getSchema(
  introspection: any,
  sortByAlphabet: boolean,
  skipRelay: boolean,
  skipDeprecated: boolean,
) {
  if (!introspection) return null;

  let schema = buildClientSchema(introspection.data);
  if (sortByAlphabet) {
    schema = lexicographicSortSchema(schema);
  }

  introspection = introspectionFromSchema(schema, { descriptions: true });
  let simpleSchema = simplifySchema(introspection.__schema);

  assignTypesAndIDs(simpleSchema);

  if (skipRelay) {
    markRelayTypes((<any>simpleSchema) as SimplifiedIntrospectionWithIds);
  }
  if (skipDeprecated) {
    markDeprecated((<any>simpleSchema) as SimplifiedIntrospectionWithIds);
  }
  return simpleSchema;
}

export function enrichIntrospection(introspection: any) {
  const copy = cloneDeep(introspection);
  const rootName = introspection.data.__schema.queryType.name;
  // the startsWith condition should be removed in the future - temporary hacky migration
  if (rootName === FAKE_ROOT_ID) {
    const fakeRootIdx = copy.data.__schema.types.findIndex(t => t.name === FAKE_ROOT_ID);
    copy.data.__schema.types[fakeRootIdx].fields = getAllFields(copy);
  } else {
    // change pointer to current root
    copy.data.__schema.queryType.name = FAKE_ROOT_ID;

    const newRoot = {
      kind: 'OBJECT',
      name: FAKE_ROOT_ID,
      description: rootName,
      inputFields: null,
      interfaces: [],
      enumValues: null,
      possibleTypes: null,
      fields: getAllFields(copy),
    };

    copy.data.__schema.types.push(newRoot);
  }

  // fix root description
  const fakeRootIdx = copy.data.__schema.types.findIndex(t => t.name === FAKE_ROOT_ID);
  const fakeRootDescription = copy.data.__schema.types[fakeRootIdx].description || '';

  // Migrate from the old type description - remove this code later
  if (fakeRootDescription.startsWith('This is a hidden')) {
    copy.data.__schema.types[fakeRootIdx].description = copy.data.__schema.types[1].name;
  }
  return copy;
}

function getAllFields(introspection) {
  return introspection.data.__schema.types
    .filter(
      t =>
        (t.kind === 'OBJECT' || t.kind === 'UNION') &&
        !t.name.startsWith('__') &&
        t.name !== FAKE_ROOT_ID,
    )
    .map(t => ({
      name: t.name,
      description: null,
      args: [],
      type: {
        kind: t.kind,
        name: t.name,
        ofType: null,
      },
    }));
}
