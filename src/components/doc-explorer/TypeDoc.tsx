import * as _ from 'lodash';
import * as React from 'react';
import * as classNames from 'classnames';

import './TypeDoc.css';

import { SimplifiedTypeWithIDs } from '../../introspection/types';
import { isMatch, highlightTerm } from '../../utils';

import Markdown from '../utils/Markdown';
import Description from './Description';
import TypeLink from './TypeLink';
import WrappedTypeName from './WrappedTypeName';
import Argument from './Argument';

interface TypeDocProps {
  selectedType: any;
  selectedEdgeID: string;
  typeGraph: any;
  filter: string;
  onSelectEdge: (string) => void;
  onTypeLink: (any) => void;
  onEditEdge: (
    typeId: string,
    edgeId: string,
    newEdgeId: string,
    newDescription: string,
    newDataType: string,
  ) => void;
  scalars: string[];
}

export default class TypeDoc extends React.Component<TypeDocProps> {
  componentDidUpdate(prevProps: TypeDocProps) {
    if (this.props.selectedEdgeID !== prevProps.selectedEdgeID) {
      this.ensureActiveVisible();
    }
  }

  componentDidMount() {
    this.ensureActiveVisible();
  }

  ensureActiveVisible() {
    let itemComponent = this.refs['selectedItem'] as HTMLElement;
    if (!itemComponent) return;

    itemComponent.scrollIntoViewIfNeeded();
  }

  render() {
    const {
      selectedType,
      selectedEdgeID,
      typeGraph,
      filter,
      onSelectEdge,
      onTypeLink,
      onEditEdge,
      scalars,
    } = this.props;

    return (
      <>
        <Description className="-doc-type" text={selectedType.description} />
        {renderTypesDef(selectedType, selectedEdgeID)}
        {renderFields(selectedType, selectedEdgeID, scalars)}
      </>
    );

    function renderTypesDef(type: SimplifiedTypeWithIDs, selectedId) {
      let typesTitle;
      let types: {
        id: string;
        type: SimplifiedTypeWithIDs;
      }[];

      switch (type.kind) {
        case 'UNION':
          typesTitle = 'possible types';
          types = type.possibleTypes;
          break;
        case 'INTERFACE':
          typesTitle = 'implementations';
          types = type.derivedTypes;
          break;
        case 'OBJECT':
          typesTitle = 'implements';
          types = type.interfaces;
          break;
        default:
          return null;
      }

      types = types.filter(({ type }) => typeGraph.nodes[type.id] && isMatch(type.name, filter));

      if (types.length === 0) return null;

      return (
        <div className="doc-category">
          <div className="title">{typesTitle}</div>
          {_.map(types, type => {
            let props: any = {
              key: type.id,
              className: classNames('item', {
                '-selected': type.id === selectedId,
              }),
              onClick: () => onSelectEdge(type.id),
            };
            if (type.id === selectedId) props.ref = 'selectedItem';
            return (
              <div {...props}>
                <TypeLink type={type.type} onClick={onTypeLink} filter={filter} />
                <Description text={type.type.description} className="-linked-type" />
              </div>
            );
          })}
        </div>
      );
    }

    function renderFields(type: SimplifiedTypeWithIDs, selectedId: string, scalars: string[]) {
      let fields: any = Object.values(type.fields);
      fields = fields.filter(field => {
        const args: any = Object.values(field.args);
        const matchingArgs = args.filter(arg => isMatch(arg.name, filter));

        return isMatch(field.name, filter) || matchingArgs.length > 0;
      });

      if (fields.length === 0) return null;
      return (
        <div className="doc-category">
          <AddNewButton selectedType={selectedType} onEditEdge={onEditEdge} scalars={scalars} />
          <div className="title">fields</div>
          {fields.map(field => {
            const props: any = {
              key: field.name,
              className: classNames('item', {
                '-selected': field.id === selectedId,
                '-with-args': !_.isEmpty(field.args),
              }),
              onClick: () => onSelectEdge(field.id),
            };
            if (field.id === selectedId) props.ref = 'selectedItem';
            return (
              <ListItem
                {...props}
                filter={filter}
                selectedId={selectedId}
                onTypeLink={onTypeLink}
                selectedType={selectedType}
                onEditEdge={onEditEdge}
                field={field}
                scalars={scalars}
              />
            );
          })}
        </div>
      );
    }
  }
}

const ListItem = ({
  filter,
  selectedId,
  onTypeLink,
  selectedType,
  onEditEdge,
  field,
  key,
  className,
  scalars,
  ...props
}: any) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const onClick = () => {
    setIsEditing(true);
    props.onClick();
  };

  return (
    <div key={key} className={className} onClick={onClick}>
      {!isEditing && <a className="field-name">{highlightTerm(field.name, filter)}</a>}
      {isEditing && (
        <input
          value={field.name}
          onChange={e => {
            onEditEdge(
              selectedType.id,
              field.name,
              e.currentTarget.value,
              field.description,
              field.type.name,
            );
          }}
        />
      )}
      <span
        className={classNames('args-wrap', {
          '-empty': _.isEmpty(field.args),
        })}
      >
        {!_.isEmpty(field.args) && (
          <span key="args" className="args">
            {_.map(field.args, arg => (
              <Argument
                key={arg.name}
                arg={arg}
                expanded={field.id === selectedId}
                onTypeLink={onTypeLink}
              />
            ))}
          </span>
        )}
      </span>
      {!isEditing && <WrappedTypeName container={field} onTypeLink={onTypeLink} />}
      {isEditing && (
        <select
          value={field.type.name}
          onChange={e => {
            console.log(e.currentTarget.value);
            onEditEdge(
              selectedType.id,
              field.name,
              field.name,
              field.description,
              e.currentTarget.value,
            );
          }}
        >
          {scalars.map(s => (
            <option value={s} key={s}>
              {s}
            </option>
          ))}
        </select>
      )}
      {field.isDeprecated && <span className="doc-alert-text"> DEPRECATED</span>}
      <Markdown
        text={field.description}
        className="description-box -field"
        isEditing={isEditing}
        onChange={(text: string) => {
          onEditEdge(selectedType.id, field.name, field.name, text, field.type.name);
        }}
      />
    </div>
  );
};

const AddNewButton = ({ onEditEdge, selectedType, scalars }: any) => (
  <button
    onClick={() => onEditEdge(selectedType.id, 'test', 'test', 'test description', scalars[0])}
  >
    New property
  </button>
);
