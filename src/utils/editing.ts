import * as _ from 'lodash';

export function createNestedType(typeWrappers: string[], typeName: string, scalars: string[]) {
  let finalType = {
    kind: scalars.includes(typeName) ? 'SCALAR' : 'OBJECT',
    name: typeName,
    ofType: null,
  };
  if (typeWrappers.includes('NON_NULL')) {
    finalType = { kind: 'NON_NULL', name: null, ofType: _.cloneDeep(finalType) };
  }
  if (typeWrappers.includes('LIST')) {
    finalType = { kind: 'LIST', name: null, ofType: _.cloneDeep(finalType) };
  }
  return finalType;
}
