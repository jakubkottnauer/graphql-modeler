import * as _ from 'lodash';
import * as React from 'react';
import * as classNames from 'classnames';
import { GlobalHotKeys } from 'react-hotkeys';
import Button from '@material-ui/core/Button';
import AddIcon from '@material-ui/icons/Add';
import { isMatch } from '../../utils';

import './TypeList.css';

import TypeLink from './TypeLink';
import Description from './Description';
import FocusTypeButton from './FocusTypeButton';
import { createNewType, createNewUnion, cloneType } from '../../utils/editing';
import { FAKE_ROOT_ID } from '../../introspection';

interface TypeListProps {
  typeGraph: any;
  filter: string;
  onFocusType: (any) => void;
  onTypeLink: (any) => void;
  onEditType: (typeId: string, typeData: any) => void;
}

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
        <div
          className="button"
          style={{
            marginBottom: '10px',
          }}
        >
          <AddUnionButton typeGraph={typeGraph} onEditType={this.props.onEditType} />
        </div>
        {rootType && renderItem(rootType, '-root')}
        {_.map(types, type => renderItem(type, ''))}
      </div>
    );

    function renderItem(type, className?: string) {
      if (!isMatch(type.name, filter) || type.name === FAKE_ROOT_ID) {
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
      createNewType(typeGraph, onEditType);
    }}
    variant="contained"
    startIcon={<AddIcon />}
    size="small"
  >
    <GlobalHotKeys
      keyMap={{ NEW_TYPE: 's' }}
      handlers={{
        NEW_TYPE: () => createNewType(typeGraph, onEditType),
      }}
    />
    New setting
  </Button>
);

export const AddUnionButton = ({ typeGraph, onEditType }: any) => (
  <Button
    onClick={() => {
      createNewUnion(typeGraph, onEditType);
    }}
    variant="contained"
    startIcon={<AddIcon />}
    size="small"
  >
    <GlobalHotKeys
      keyMap={{ NEW_UNION: 'u' }}
      handlers={{
        NEW_UNION: () => createNewUnion(typeGraph, onEditType),
      }}
    />
    New union
  </Button>
);

export const CloneTypeButton = ({ typeGraph, onEditType, selectedType, scalars }: any) => {
  return (
    <Button
      onClick={() => {
        cloneType(typeGraph, onEditType, selectedType, scalars);
      }}
      variant="contained"
      size="small"
    >
      <GlobalHotKeys
        keyMap={{ CLONE_TYPE: 'c' }}
        handlers={{
          CLONE_TYPE: () => cloneType(typeGraph, onEditType, selectedType, scalars),
        }}
      />
      Clone
    </Button>
  );
};
