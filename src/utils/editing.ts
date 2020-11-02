import { cloneDeep } from 'lodash';
import { FAKE_ROOT_ID } from '../introspection';

export function createNestedType(typeWrappers: string[], typeName: string, scalars: string[]) {
  let finalType = {
    kind: scalars.includes(typeName) ? 'SCALAR' : 'OBJECT',
    name: typeName,
    ofType: null,
  };
  if (typeWrappers.includes('NON_NULL')) {
    finalType = { kind: 'NON_NULL', name: null, ofType: cloneDeep(finalType) };
  }
  if (typeWrappers.includes('LIST')) {
    finalType = { kind: 'LIST', name: null, ofType: cloneDeep(finalType) };
  }
  return finalType;
}

export function createNewUnion(typeGraph, onEditType) {
  const newTypeName = 'NewUnion';
  let counter = 1;
  let typeName = newTypeName + counter++;
  while (typeGraph.nodes['TYPE::' + typeName]) {
    typeName = newTypeName + counter++;
  }
  const union = unionFactory(typeName);
  // find any of existing objects because we need a default
  const firstObject: any = Object.values(typeGraph.nodes).find(
    (n: any) => n.kind === 'OBJECT' && n.name !== FAKE_ROOT_ID,
  );
  union.possibleTypes = [{ kind: 'OBJECT', name: firstObject.name, ofType: null }];
  onEditType(typeName, union);
}

export function createNewType(typeGraph, onEditType) {
  const newTypeName = 'NewSetting';
  let counter = 1;
  let typeName = newTypeName + counter++;
  while (typeGraph.nodes['TYPE::' + typeName]) {
    typeName = newTypeName + counter++;
  }
  onEditType(typeName, typeFactory(typeName));
}

const unionFactory = (id: string) => ({
  kind: 'UNION',
  name: id,
  description: null,
  fields: {},
  inputFields: null,
  interfaces: [],
  possibleTypes: [],
});

const typeFactory = (id: string) => ({
  kind: 'OBJECT',
  name: id,
  description: null,
  fields: [
    {
      name: 'id',
      description: null,
      args: [],
      type: {
        kind: 'NON_NULL',
        name: null,
        ofType: { kind: 'SCALAR', name: 'String', ofType: null },
      },
      isDeprecated: false,
      deprecationReason: null,
    },
  ],
  inputFields: null,
  interfaces: [],
  enumValues: null,
  possibleTypes: null,
});

export function cloneType(typeGraph, onEditType, selectedType, scalars) {
  const newTypeName = selectedType.name + '_Copy';
  let counter = 1;
  let typeName = newTypeName + counter++;
  while (typeGraph.nodes['TYPE::' + typeName]) {
    typeName = newTypeName + counter++;
  }
  if (selectedType.kind === 'OBJECT') {
    const copy = typeFactory(typeName);
    copy.description = selectedType.description;
    // @ts-ignore
    copy.fields = Object.values(selectedType.fields).map((x: any) => {
      const field = {
        name: null,
        description: null,
        args: [],
        type: {},
        isDeprecated: false,
        deprecationReason: null,
      };

      field.name = x.name;
      field.description = x.description;
      field.type = createNestedType(x.typeWrappers, x.type.name, scalars);

      return field;
    });
    onEditType(typeName, copy);
  } else if (selectedType.kind === 'UNION') {
    const copy = typeFactory(typeName);
    copy.description = selectedType.description;
    // @ts-ignore

    copy.possibleTypes = selectedType.possibleTypes.map(p => ({
      kind: p.type.kind,
      name: p.type.name,
      ofType: null,
    }));

    onEditType(typeName, copy);
  }
}

export function createNewAttribute(selectedType, onEditEdge, scalars) {
  let counter = 1;
  let id = 'attribute' + counter++;
  while (selectedType && selectedType.fields[id]) {
    id = 'attribute' + counter++;
  }
  onEditEdge(id, id, id + ' description', scalars[0], []);
}
