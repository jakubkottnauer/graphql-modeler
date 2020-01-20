import * as _ from 'lodash';
import * as React from 'react';
import * as classNames from 'classnames';

import Button from '@material-ui/core/Button';
import AddIcon from '@material-ui/icons/Add';
import { isMatch } from '../../utils';

import './TypeList.css';

import TypeLink from './TypeLink';
import Description from './Description';
import FocusTypeButton from './FocusTypeButton';
import { createNestedType } from '../../utils/editing';

interface TypeListProps {
  typeGraph: any;
  filter: string;
  onFocusType: (any) => void;
  onTypeLink: (any) => void;
  onEditType: (typeId: string, typeData: any) => void;
}

const createNewType = (id: string) => ({
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

let counter = 1;

export default class TypeList extends React.Component<TypeListProps> {
  render() {
    const { typeGraph, filter, onFocusType, onTypeLink } = this.props;
    if (typeGraph === null) return null;

    const rootType = typeGraph.nodes[typeGraph.rootId];
    const types = _(typeGraph.nodes)
      .values()
      .reject({ id: rootType && rootType.id })
      .sortBy('name')
      .value();

    return (
      <div className="doc-explorer-type-list">
        <div
          className="button"
          style={{
            marginBottom: '10px',
          }}
        >
          <AddTypeButton typeGraph={typeGraph} onEditType={this.props.onEditType} />
        </div>
        {rootType && renderItem(rootType, '-root')}
        {_.map(types, type => renderItem(type, ''))}
      </div>
    );

    function renderItem(type, className?: string) {
      if (!isMatch(type.name, filter)) {
        return null;
      }

      return (
        <div key={type.id} className={classNames('typelist-item', className)}>
          <TypeLink type={type} onClick={onTypeLink} filter={filter} />
          <FocusTypeButton onClick={() => onFocusType(type)} />
          <Description className="-doc-type" text={type.description} />
        </div>
      );
    }
  }
}

export const AddTypeButton = ({ typeGraph, onEditType }: any) => (
  <Button
    onClick={() => {
      const newTypeName = 'NewSetting';
      let typeName = newTypeName + counter++;
      while (typeGraph.nodes['TYPE::' + typeName]) {
        typeName = newTypeName + counter++;
      }
      onEditType(typeName, createNewType(typeName));
    }}
    variant="contained"
    startIcon={<AddIcon />}
    size="small"
  >
    New setting
  </Button>
);

export const CloneTypeButton = ({ typeGraph, onEditType, selectedType, scalars }: any) => {
  return (
    <Button
      onClick={() => {
        const newTypeName = selectedType.name + '_Copy';
        let typeName = newTypeName + counter++;
        while (typeGraph.nodes['TYPE::' + typeName]) {
          typeName = newTypeName + counter++;
        }
        const copy = createNewType(typeName);
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
      }}
      variant="contained"
      size="small"
    >
      Clone
    </Button>
  );
};
