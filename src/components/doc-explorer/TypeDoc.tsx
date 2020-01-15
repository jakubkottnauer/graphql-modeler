import * as _ from 'lodash';
import * as React from 'react';
import * as classNames from 'classnames';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Select from '@material-ui/core/Select';
import Input from '@material-ui/core/Input';
import MenuItem from '@material-ui/core/MenuItem';
import DeleteIcon from '@material-ui/icons/Delete';
import AddIcon from '@material-ui/icons/Add';
import SaveIcon from '@material-ui/icons/Save';
import DragIndicatorIcon from '@material-ui/icons/DragIndicator';

import './TypeDoc.css';
import {
  DndProvider,
  DropTarget,
  XYCoord,
  DropTargetConnector,
  DragSource,
  DragSourceConnector,
  DragSourceMonitor,
} from 'react-dnd';
import Backend from 'react-dnd-html5-backend';

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
  onEditType: (typeId: string, typeData: any) => void;
  scalars: string[];
}

const TypeDoc = ({
  selectedEdgeID,
  typeGraph,
  filter,
  onSelectEdge,
  onTypeLink,
  onDeleteType,
  scalars,
  onEditType,
  ...props
}: TypeDocProps) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [selectedType, setSelectedType] = React.useState<any | null>(null);
  const selectedItemRef = React.useRef<HTMLElement>();
  const usedSelectedType = isEditing ? selectedType : props.selectedType;

  const enableEditing = () => {
    if (isEditing) {
      return;
    }

    const type = _.cloneDeep(usedSelectedType);

    type.fields = Object.values(type.fields).reduce(
      (acc: any, f: any, idx) => ({
        ...acc,
        [f.name]: { ...f, originalName: f.name, originalPosition: idx },
      }),
      {},
    );

    setIsEditing(true);
    setSelectedType(type);
    return type;
  };

  React.useEffect(() => {
    if (selectedItemRef.current?.scrollIntoViewIfNeeded) {
      selectedItemRef.current?.scrollIntoViewIfNeeded();
    }
  }, [selectedItemRef.current]);

  const onEditEdge = (fieldId, newFieldId, newDescription, newDataType, newTypeWrappers) => {
    const typeCopy = isEditing ? _.cloneDeep(usedSelectedType) : enableEditing();
    if (!typeCopy.fields[fieldId]) {
      typeCopy.fields[fieldId] = _.cloneDeep(typeCopy.fields[Object.keys(typeCopy.fields)[0]]);
      typeCopy.fields[fieldId].originalName = fieldId;
      typeCopy.fields[fieldId].originalPosition = Object.keys(typeCopy.fields).length;
    }
    typeCopy.fields[fieldId].name = newFieldId;
    typeCopy.fields[fieldId].description = newDescription;
    typeCopy.fields[fieldId].type = { ...typeCopy.fields[fieldId].type };
    typeCopy.fields[fieldId].type.name = newDataType;
    typeCopy.fields[fieldId].typeWrappers = newTypeWrappers;
    setSelectedType(typeCopy);
  };

  const moveItem = (dragIdx: number, hoverIdx: number) => {
    const typeCopy = _.cloneDeep(selectedType);
    const drag: any = Object.values(typeCopy.fields).find(
      (f: any) => f.originalPosition === dragIdx,
    );
    const hover: any = Object.values(typeCopy.fields).find(
      (f: any) => f.originalPosition === hoverIdx,
    );

    const tmp = typeCopy.fields[drag.name].originalPosition;
    typeCopy.fields[drag.name].originalPosition = typeCopy.fields[hover.name].originalPosition;
    typeCopy.fields[hover.name].originalPosition = tmp;
    setSelectedType(typeCopy);
  };

  const onDeleteEdge = fieldId => {
    const typeCopy = isEditing ? _.cloneDeep(usedSelectedType) : enableEditing();
    delete typeCopy.fields[fieldId];
    setSelectedType(typeCopy);
  };

  const renderTypesDef = () => {
    let typesTitle;
    let types: {
      id: string;
      type: SimplifiedTypeWithIDs;
    }[];

    switch (usedSelectedType.kind) {
      case 'UNION':
        typesTitle = 'possible types';
        types = usedSelectedType.possibleTypes;
        break;
      case 'INTERFACE':
        typesTitle = 'implementations';
        types = usedSelectedType.derivedTypes;
        break;
      case 'OBJECT':
        typesTitle = 'implements';
        types = usedSelectedType.interfaces;
        break;
      default:
        return null;
    }

    types = types.filter(({ type }) => typeGraph.nodes[type.id] && isMatch(type.name, filter));

    if (types.length === 0) return null;

    return (
      <div className={classNames('doc-category', isEditing && 'editing')}>
        <div className="title">{typesTitle}</div>
        {_.map(types, type => {
          let props: any = {
            key: type.id,
            className: classNames('item', {
              '-selected': type.id === selectedEdgeID,
            }),
            onClick: () => onSelectEdge(type.id),
          };
          if (type.id === selectedEdgeID) props.ref = selectedItemRef;
          return (
            <div {...props}>
              <TypeLink type={type.type} onClick={onTypeLink} filter={filter} />
              <Description text={type.type.description} className="-linked-type" />
            </div>
          );
        })}
      </div>
    );
  };

  const renderFields = () => {
    let fields: any = Object.values(usedSelectedType.fields);
    fields.sort((a: any, b: any) => a.originalPosition - b.originalPosition);
    fields = fields.filter(field => {
      const args: any = Object.values(field.args);
      const matchingArgs = args.filter(arg => isMatch(arg.name, filter));
      return isMatch(field.name, filter) || matchingArgs.length > 0;
    });
    if (fields.length === 0) return null;
    return (
      <div className={classNames('doc-category', isEditing && 'editing')}>
        <div className="title">fields</div>
        <AddNewButton selectedType={selectedType} onEditEdge={onEditEdge} scalars={scalars} />
        {fields.map(field => {
          const props: any = {
            key: field.name,
            className: classNames('item', {
              '-selected': field.id === selectedEdgeID,
              '-with-args': !_.isEmpty(field.args),
            }),
            onClick: () => onSelectEdge(field.id),
          };
          if (field.id === selectedEdgeID) props.ref = selectedItemRef;

          const ListItemComponent = isEditing ? DraggableListItem : ListItem;
          return (
            <ListItemComponent
              {...props}
              key={field.originalName || field.name}
              filter={filter}
              selectedId={selectedEdgeID}
              onTypeLink={onTypeLink}
              selectedType={selectedType}
              onEditEdge={onEditEdge}
              field={field}
              scalars={scalars}
              isEditing={isEditing}
              enableEditing={enableEditing}
              onDeleteEdge={onDeleteEdge}
              moveItem={moveItem}
            />
          );
        })}
      </div>
    );
  };

  return (
    <>
      {!isEditing && (
        <div className="button-row">
          <div className="button">
            <Button size="small" variant="contained" color="primary" onClick={enableEditing}>
              Edit type
            </Button>
          </div>
          <div className="button">
            <Button
              size="small"
              variant="contained"
              onClick={() => onDeleteType(usedSelectedType.id)}
            >
              Delete type
            </Button>
          </div>
        </div>
      )}

      {isEditing ? (
        <>
          <div className="type-edit-wrapper">
            <Input
              value={usedSelectedType.name}
              onChange={e => setSelectedType({ ...selectedType, name: e.currentTarget.value })}
            />
          </div>
          <div className="type-edit-wrapper">
            <Input
              value={usedSelectedType.description}
              onChange={e =>
                setSelectedType({ ...selectedType, description: e.currentTarget.value })
              }
            />
          </div>
        </>
      ) : (
        <Description className="-doc-type" text={usedSelectedType.description} />
      )}
      {renderTypesDef()}

      <DndProvider backend={Backend}>{renderFields()}</DndProvider>
      {isEditing && (
        <EditButtons
          selectedTypeId={props.selectedType.id}
          selectedType={usedSelectedType}
          setIsEditing={setIsEditing}
          setSelectedType={setSelectedType}
          onEditType={onEditType}
        />
      )}
    </>
  );
};

export default TypeDoc;

const EditButtons = ({
  selectedTypeId,
  selectedType,
  setIsEditing,
  setSelectedType,
  onEditType,
}: any) => (
  <div className="button-row">
    <div className="button">
      <Button
        variant="contained"
        size="small"
        onClick={() => {
          onEditType(selectedTypeId, selectedType);
          setIsEditing(false);
          setSelectedType(null);
        }}
        color="primary"
        startIcon={<SaveIcon />}
      >
        Save
      </Button>
    </div>
    <div className="button">
      <Button color="primary" size="small" onClick={() => setIsEditing(false)}>
        Cancel
      </Button>
    </div>
  </div>
);

const ListItem = React.forwardRef<HTMLDivElement, any>(
  (
    {
      filter,
      selectedId,
      onTypeLink,
      onEditEdge,
      field,
      key,
      className,
      scalars,
      isEditing,
      enableEditing,
      onDeleteEdge,
      ...props
    }: any,
    ref,
  ) => {
    const elementRef = React.useRef(null);
    if (props.connectDragSource) {
      props.connectDragSource(elementRef);
      props.connectDropTarget(elementRef);
    }
    React.useImperativeHandle<{}, any>(ref, () => ({
      getNode: () => elementRef.current,
    }));
    const opacity = props.isDragging ? 0 : 1;

    return (
      <div key={key} className={className} ref={elementRef} style={{ opacity, display: 'flex' }}>
        <div style={{ width: '250px' }}>
          <a className="field-name">{highlightTerm(field.name, filter)}</a>
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
          <WrappedTypeName container={field} onTypeLink={onTypeLink} />
          {field.isDeprecated && <span className="doc-alert-text"> DEPRECATED</span>}
          <Markdown text={field.description} className="description-box -field" />
        </div>
        <div className="edit-field-icon-column">
          <IconButton onClick={() => onDeleteEdge(field.name)}>
            <DeleteIcon />
          </IconButton>
        </div>
      </div>
    );
  },
);

const ListItemEdit = React.forwardRef<HTMLDivElement, any>(
  (
    {
      filter,
      selectedId,
      onTypeLink,
      onEditEdge,
      field,
      key,
      className,
      scalars,
      enableEditing,
      onDeleteEdge,
      ...props
    }: any,
    ref,
  ) => {
    const elementRef = React.useRef(null);
    if (props.connectDragSource) {
      props.connectDragSource(elementRef);
      props.connectDropTarget(elementRef);
    }
    React.useImperativeHandle<{}, any>(ref, () => ({
      getNode: () => elementRef.current,
    }));
    const opacity = props.isDragging ? 0 : 1;

    const onEditName = (name: string) =>
      onEditEdge(field.originalName, name, field.description, field.type.name, field.typeWrappers);
    const onEditDescription = (description: string) =>
      onEditEdge(field.originalName, field.name, description, field.type.name, field.typeWrappers);
    const onEditType = (type: string) =>
      onEditEdge(field.originalName, field.name, field.description, type, field.typeWrappers);
    const onCheckBoxChange = (name: 'NON_NULL' | 'LIST', value: boolean) =>
      onEditEdge(
        field.originalName,
        field.name,
        field.description,
        field.type.name,
        value ? [...field.typeWrappers, name] : field.typeWrappers.filter(w => w != name),
      );

    return (
      <div key={key} className={className} ref={elementRef} style={{ opacity, display: 'flex' }}>
        <div className="edit-field-icon-column">
          <span title="Drag to reorder fields" style={{ cursor: 'move' }}>
            <DragIndicatorIcon />
          </span>
        </div>
        <div>
          <Input
            value={field.name}
            onChange={e => onEditName(e.currentTarget.value)}
            placeholder="Field name"
            required
            style={{ width: '60%' }}
          />
          <Select
            value={field.type.name}
            required
            onChange={e => onEditType(e.target.value as string)}
            style={{ width: '35%', marginLeft: '5px' }}
          >
            {scalars.map(s => (
              <MenuItem value={s} key={s}>
                {s}
              </MenuItem>
            ))}
          </Select>
          <Input
            value={field.description}
            onChange={e => onEditDescription(e.currentTarget.value)}
            style={{ width: '100%' }}
            placeholder="Description"
          />
          <div>
            <FormControlLabel
              control={
                <Checkbox
                  checked={field.typeWrappers.includes('NON_NULL')}
                  onChange={e => onCheckBoxChange('NON_NULL', e.currentTarget.checked)}
                  color="primary"
                />
              }
              label="Required"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={field.typeWrappers.includes('LIST')}
                  onChange={e => onCheckBoxChange('LIST', e.currentTarget.checked)}
                  color="primary"
                />
              }
              label="List"
            />
          </div>
        </div>
        <div className="edit-field-icon-column">
          <IconButton onClick={() => onDeleteEdge(field.name)}>
            <DeleteIcon />
          </IconButton>
        </div>
      </div>
    );
  },
);

let counter = 1;

const AddNewButton = ({ onEditEdge, scalars }: any) => (
  <div className="button">
    <Button
      startIcon={<AddIcon />}
      style={{
        marginBottom: '10px',
      }}
      size="small"
      variant="contained"
      onClick={() => {
        const id = 'test' + counter++;
        onEditEdge(id, id, id + ' description', scalars[0], []);
      }}
    >
      Add field
    </Button>
  </div>
);

const Item = 'item';
const DraggableListItem = DropTarget(
  Item,
  {
    hover(props: any, monitor: any, component: any) {
      if (!component) {
        return null;
      }
      // node = HTML Div element from imperative API
      const node = component.getNode();
      if (!node) {
        return null;
      }
      const dragIndex = monitor.getItem().index;
      const hoverIndex = props.field.originalPosition;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }
      // Determine rectangle on screen
      const hoverBoundingRect = node.getBoundingClientRect();

      // Get vertical middle
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;

      // Determine mouse position
      const clientOffset = monitor.getClientOffset();

      // Get pixels to the top
      const hoverClientY = (clientOffset as XYCoord).y - hoverBoundingRect.top;

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%

      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }
      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }
      // Time to actually perform the action
      props.moveItem(dragIndex, hoverIndex);

      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      monitor.getItem().index = hoverIndex;
    },
  },
  (connect: DropTargetConnector) => ({
    connectDropTarget: connect.dropTarget(),
  }),
)(
  DragSource(
    Item,
    {
      beginDrag: (props: any) => ({
        id: props.field.id,
        index: props.field.originalPosition,
      }),
    },
    (connect: DragSourceConnector, monitor: DragSourceMonitor) => ({
      connectDragSource: connect.dragSource(),
      isDragging: monitor.isDragging(),
    }),
  )(ListItemEdit),
);
