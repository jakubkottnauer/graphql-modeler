import * as _ from 'lodash';
import * as React from 'react';
import * as classNames from 'classnames';
import Button from '@material-ui/core/Button';
import Select from '@material-ui/core/Select';
import Input from '@material-ui/core/Input';
import MenuItem from '@material-ui/core/MenuItem';

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
  onDeleteType: (typeId) => void;
  // onEditEdge: (
  //   typeId: string,
  //   edgeId: string,
  //   newEdgeId: string,
  //   newDescription: string,
  //   newDataType: string,
  // ) => void;
  onEditType: (typeId: string, typeData: any) => void;
  scalars: string[];
}

export default class TypeDoc extends React.Component<TypeDocProps> {
  state = {
    isEditing: false,
    selectedType: null,
  };

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

  enableEditing = () => {
    if (this.state.isEditing) {
      return;
    }

    const type = _.cloneDeep(this.props.selectedType);

    type.fields = Object.values(type.fields).reduce(
      (acc: any, f: any, idx) => ({
        ...acc,
        [f.name]: { ...f, originalName: f.name, originalPosition: idx },
      }),
      {},
    );
    this.setState({ isEditing: true, selectedType: type });
  };

  render() {
    const {
      selectedEdgeID,
      typeGraph,
      filter,
      onSelectEdge,
      onTypeLink,
      onDeleteType,
      scalars,
      onEditType,
    } = this.props;

    const selectedType = this.state.isEditing ? this.state.selectedType : this.props.selectedType;
    const onEditEdge = (fieldId, newFieldId, newDescription, newDataType) => {
      const typeCopy = _.cloneDeep(this.state.selectedType);
      if (!typeCopy.fields[fieldId]) {
        typeCopy.fields[fieldId] = _.cloneDeep(typeCopy.fields[Object.keys(typeCopy.fields)[0]]);
        typeCopy.fields[fieldId].originalName = fieldId;
      }
      typeCopy.fields[fieldId].name = newFieldId;
      typeCopy.fields[fieldId].description = newDescription;
      typeCopy.fields[fieldId].type = { ...typeCopy.fields[fieldId].type };
      typeCopy.fields[fieldId].type.name = newDataType;

      this.setState({ selectedType: typeCopy });
    };

    return (
      <>
        {!this.state.isEditing && (
          <Button variant="contained" color="primary" onClick={this.enableEditing}>
            Edit
          </Button>
        )}
        <Button variant="contained" color="secondary" onClick={() => onDeleteType(selectedType.id)}>
          Delete type
        </Button>
        {this.state.isEditing ? (
          <>
            <Input
              value={selectedType.name}
              onChange={e =>
                this.setState({
                  selectedType: { ...this.state.selectedType, name: e.currentTarget.value },
                })
              }
            />
            <Input
              value={selectedType.description}
              onChange={e =>
                this.setState({
                  selectedType: { ...this.state.selectedType, description: e.currentTarget.value },
                })
              }
            />
          </>
        ) : (
          <Description className="-doc-type" text={selectedType.description} />
        )}
        {renderTypesDef(selectedType, selectedEdgeID)}
        {renderFields(
          selectedType,
          selectedEdgeID,
          this.state.isEditing,
          scalars,
          this.enableEditing,
        )}
        {this.state.isEditing && (
          <>
            <Button
              variant="contained"
              onClick={() => {
                onEditType(this.props.selectedType.id, selectedType);
                this.setState({ isEditing: false, selectedType: null });
              }}
              color="primary"
            >
              Save changes
            </Button>
            <Button variant="contained" onClick={() => this.setState({ isEditing: false })}>
              Cancel
            </Button>
          </>
        )}
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

    function renderFields(
      type: SimplifiedTypeWithIDs,
      selectedId: string,
      isEditing: boolean,
      scalars: string[],
      enableEditing: Function,
    ) {
      let fields: any = Object.values(type.fields);
      fields = fields.filter(field => {
        const args: any = Object.values(field.args);
        const matchingArgs = args.filter(arg => isMatch(arg.name, filter));

        return isMatch(field.name, filter) || matchingArgs.length > 0;
      });

      if (fields.length === 0) return null;
      return (
        <div className="doc-category">
          <AddNewButton
            selectedType={selectedType}
            onEditEdge={onEditEdge}
            scalars={scalars}
            enableEditing={enableEditing}
          />
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
                key={field.originalName || field.name}
                filter={filter}
                selectedId={selectedId}
                onTypeLink={onTypeLink}
                selectedType={selectedType}
                onEditEdge={onEditEdge}
                field={field}
                scalars={scalars}
                isEditing={isEditing}
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
  onEditEdge,
  field,
  key,
  className,
  scalars,
  isEditing,
}: any) => {
  return (
    <div key={key} className={className}>
      {!isEditing && <a className="field-name">{highlightTerm(field.name, filter)}</a>}
      {isEditing && (
        <Input
          value={field.name}
          onChange={e => {
            onEditEdge(
              field.originalName,
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
        <Select
          value={field.type.name}
          onChange={e => {
            onEditEdge(field.originalName, field.name, field.description, e.target.value);
          }}
        >
          {scalars.map(s => (
            <MenuItem value={s} key={s}>
              {s}
            </MenuItem>
          ))}
        </Select>
      )}
      {field.isDeprecated && <span className="doc-alert-text"> DEPRECATED</span>}
      {isEditing ? (
        <Input
          value={field.description}
          onChange={e =>
            onEditEdge(field.originalName, field.name, e.currentTarget.value, field.type.name)
          }
        />
      ) : (
        <Markdown text={field.description} className="description-box -field" />
      )}
    </div>
  );
};

let counter = 1;

const AddNewButton = ({ onEditEdge, scalars, enableEditing }: any) => (
  <Button
    variant="contained"
    onClick={() => {
      enableEditing();
      setTimeout(() => {
        //do this after state has been updated in enableEditing
        const id = 'test' + counter++;
        onEditEdge(id, id, id + ' description', scalars[0]);
      });
    }}
  >
    New field
  </Button>
);
