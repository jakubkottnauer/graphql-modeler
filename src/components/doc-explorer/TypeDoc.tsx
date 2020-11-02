import { cloneDeep, map, isEmpty } from 'lodash';
import * as React from 'react';

import * as classNames from 'classnames';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Select from '@material-ui/core/Select';
import Input from '@material-ui/core/Input';
import TextField from '@material-ui/core/TextField';
import MenuItem from '@material-ui/core/MenuItem';
import ListItemText from '@material-ui/core/ListItemText';
import InputLabel from '@material-ui/core/InputLabel';
import FormControl from '@material-ui/core/FormControl';

import DeleteIcon from '@material-ui/icons/Delete';
import AddIcon from '@material-ui/icons/Add';
import SaveIcon from '@material-ui/icons/Save';
import DragIndicatorIcon from '@material-ui/icons/DragIndicator';
import EditIcon from '@material-ui/icons/Edit';

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
import { GlobalHotKeys } from 'react-hotkeys';

import { SimplifiedTypeWithIDs } from '../../introspection/types';
import { isMatch, highlightTerm } from '../../utils';

import Markdown from '../utils/Markdown';
import Description from './Description';
import TypeLink from './TypeLink';
import WrappedTypeName from './WrappedTypeName';
import Argument from './Argument';
import { AddTypeButton, AddUnionButton, CloneTypeButton } from './TypeList';
import { FAKE_ROOT_ID } from '../../introspection';
import { createNewAttribute } from '../../utils/editing';

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

// hacky global flag to determine if the current edit state was caused by a new attribute being added
// automatically reset after 100ms
let editCausedByNewAttribute = false;

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
  React.useEffect(() => {
    if (selectedItemRef.current?.scrollIntoViewIfNeeded) {
      selectedItemRef.current?.scrollIntoViewIfNeeded();
    }
  }, [selectedItemRef.current]);

  const usedSelectedType = isEditing ? selectedType : props.selectedType;
  if (!usedSelectedType) {
    return null;
  }
  const enableEditing = () => {
    if (isEditing) {
      return;
    }

    const type = cloneDeep(usedSelectedType);

    type.fields = Object.values(type.fields).reduce(
      (acc: any, f: any, idx) => ({
        ...acc,
        [f.name]: { ...f, originalName: f.name, originalPosition: idx },
      }),
      {},
    );

    setIsEditing(true);
    setSelectedType(type);
  };

  const onEditEdge = (fieldId, newFieldId, newDescription, newDataType, newTypeWrappers) => {
    let typeCopy = cloneDeep(usedSelectedType);

    if (!isEditing) {
      typeCopy.fields = Object.values(typeCopy.fields).reduce(
        (acc: any, f: any, idx) => ({
          ...acc,
          [f.name]: { ...f, originalName: f.name, originalPosition: idx },
        }),
        {},
      );
    }
    if (!typeCopy.fields[fieldId]) {
      typeCopy.fields[fieldId] = cloneDeep(typeCopy.fields[Object.keys(typeCopy.fields)[0]]);
      typeCopy.fields[fieldId].originalName = fieldId;
      typeCopy.fields[fieldId].originalPosition = Object.keys(typeCopy.fields).length;
    }
    typeCopy.fields[fieldId].name = newFieldId;
    typeCopy.fields[fieldId].description = newDescription;
    typeCopy.fields[fieldId].type = { ...typeCopy.fields[fieldId].type };
    typeCopy.fields[fieldId].type.name = newDataType;
    typeCopy.fields[fieldId].typeWrappers = newTypeWrappers;
    setIsEditing(true);
    setSelectedType(typeCopy);
  };

  const moveItem = (dragIdx: number, hoverIdx: number) => {
    const typeCopy = cloneDeep(selectedType);
    const drag: any = Object.values(typeCopy.fields).find(
      (f: any) => f.originalPosition === dragIdx,
    );
    const hover: any = Object.values(typeCopy.fields).find(
      (f: any) => f.originalPosition === hoverIdx,
    );
    const tmp = typeCopy.fields[drag.originalName].originalPosition;
    typeCopy.fields[drag.originalName].originalPosition =
      typeCopy.fields[hover.originalName].originalPosition;
    typeCopy.fields[hover.originalName].originalPosition = tmp;
    setSelectedType(typeCopy);
  };

  const onDeleteEdge = fieldId => {
    const typeCopy = cloneDeep(usedSelectedType);
    if (Object.keys(typeCopy.fields).length === 1) {
      // deleting last field -> delete type
      onDeleteType(typeCopy.id);
      return;
    }
    delete typeCopy.fields[fieldId];
    setIsEditing(true);
    setSelectedType(typeCopy);
  };

  const onEditUnion = (selectedValues: string[]) => {
    const typeCopy = cloneDeep(usedSelectedType);
    // we don't care about the field details when editing so most of the data are just stubs
    typeCopy.possibleTypes = selectedValues.map(value => ({
      id: 'notimportant',
      type: {
        kind: 'OBJECT',
        name: value,
        description: 'haha',
        interfaces: [],
        fields: {},
        id: 'TYPE::' + value,
      },
    }));
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
        typesTitle = 'possible settings';
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

    if (types.length === 0 && (usedSelectedType.kind !== 'UNION' || !isEditing)) return null;

    return (
      <div className={classNames('doc-category', isEditing && 'editing')}>
        <div className="title">{typesTitle}</div>
        {isEditing && usedSelectedType.kind === 'UNION' ? (
          <UnionEdit
            types={types}
            typeGraph={typeGraph}
            selectedType={usedSelectedType}
            onChange={onEditUnion}
          />
        ) : (
          map(types, type => {
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
          })
        )}
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
        <div className="title">attributes</div>
        <AddNewButton selectedType={usedSelectedType} onEditEdge={onEditEdge} scalars={scalars} />
        {fields.map((field, idx) => {
          const props: any = {
            key: field.name,
            className: classNames('item', {
              '-selected': field.id === selectedEdgeID,
              '-with-args': !isEditing && !isEmpty(field.args),
            }),
            onClick: () => onSelectEdge(field.id),
          };
          if (field.id === selectedEdgeID) props.ref = selectedItemRef;

          const ListItemComponent = isEditing ? DraggableListItem : ListItem;
          const isLast = fields.length - 1 === idx;
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
              isLast={isLast}
            />
          );
        })}
        <div style={{ marginTop: 5 }}>
          <AddNewButton selectedType={usedSelectedType} onEditEdge={onEditEdge} scalars={scalars} />
        </div>
      </div>
    );
  };

  return (
    <>
      {!isEditing && (
        <>
          <div className="button-row">
            <GlobalHotKeys
              keyMap={{ DELETE: ['d', 'del'], EDIT: 'e' }}
              handlers={{
                DELETE: () => onDeleteType(usedSelectedType.id),
                EDIT: enableEditing,
              }}
            />
            <div className="button">
              <Button
                size="small"
                variant="contained"
                color="primary"
                onClick={enableEditing}
                startIcon={<EditIcon />}
              >
                Edit
              </Button>
            </div>
            <div className="button">
              <Button
                size="small"
                variant="contained"
                onClick={() => onDeleteType(usedSelectedType.id)}
              >
                Delete
              </Button>
            </div>
            <div className="button">
              <CloneTypeButton
                typeGraph={typeGraph}
                onEditType={onEditType}
                selectedType={usedSelectedType}
                scalars={scalars}
              />
            </div>
          </div>
          <div className="button-row">
            <div className="button">
              <AddTypeButton typeGraph={typeGraph} onEditType={onEditType} />
            </div>
            <div className="button">
              <AddUnionButton typeGraph={typeGraph} onEditType={onEditType} />
            </div>
          </div>
        </>
      )}

      {isEditing ? (
        <>
          <div className="type-edit-wrapper">
            <TextField
              label="Setting name"
              error={!usedSelectedType.name?.length}
              value={usedSelectedType.name}
              onChange={e => setSelectedType({ ...selectedType, name: e.currentTarget.value })}
            />
          </div>
          <div className="type-edit-wrapper">
            <TextField
              label="Setting description"
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
}: any) => {
  const cancel = () => setIsEditing(false);

  const save = () => {
    onEditType(selectedTypeId, selectedType);
    setIsEditing(false);
    setSelectedType(null);
  };
  return (
    <div className="button-row">
      <div className="button">
        <GlobalHotKeys
          allowChanges
          keyMap={{ SAVE: 'enter', CANCEL: 'esc' }}
          handlers={{
            SAVE: save,
            CANCEL: cancel,
          }}
        />
        <Button
          variant="contained"
          size="small"
          onClick={save}
          color="primary"
          startIcon={<SaveIcon />}
        >
          Save
        </Button>
      </div>
      <div className="button">
        <Button color="primary" size="small" onClick={cancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

const ListItem = ({ filter, selectedId, onTypeLink, field, key, className, onDeleteEdge }: any) => (
  <div key={key} className={className} style={{ display: 'flex' }}>
    <div style={{ width: '250px' }}>
      <a className="field-name">{highlightTerm(field.name, filter)}</a>
      <span
        className={classNames('args-wrap', {
          '-empty': isEmpty(field.args),
        })}
      >
        {!isEmpty(field.args) && (
          <span key="args" className="args">
            {map(field.args, arg => (
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
      isLast,
      ...props
    }: any,
    ref,
  ) => {
    const elementRef = React.useRef(null);
    const handleRef = React.useRef(null);
    const nameInputRef = React.useRef(null);
    React.useEffect(() => {
      if (isLast && nameInputRef.current && editCausedByNewAttribute) {
        nameInputRef.current.focus();
      }
    }, [nameInputRef]);

    if (props.connectDragSource) {
      props.connectDragPreview(elementRef);
      props.connectDragSource(handleRef);
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
      <div key={key} ref={elementRef} className={className} style={{ opacity, display: 'flex' }}>
        <div
          ref={handleRef}
          className="edit-field-icon-column edit-field-drag"
          title="Drag to reorder attributes"
        >
          <DragIndicatorIcon />
        </div>
        <div>
          <TextField
            value={field.name}
            onChange={e => onEditName(e.currentTarget.value)}
            label="Attribute name"
            error={!field.name?.length}
            style={{ width: '55%' }}
            inputRef={nameInputRef}
          />
          <FormControl style={{ width: '42%', marginLeft: '2px' }}>
            <InputLabel shrink>Type</InputLabel>
            <Select
              value={field.type.name}
              required
              onChange={e => onEditType(e.target.value as string)}
            >
              {scalars.map(s => (
                <MenuItem value={s} key={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            value={field.description}
            onChange={e => onEditDescription(e.currentTarget.value)}
            style={{ width: '100%' }}
            label="Description"
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

const AddNewButton = ({ selectedType, onEditEdge, scalars }: any) => {
  const handler = () => {
    editCausedByNewAttribute = true;
    createNewAttribute(selectedType, onEditEdge, scalars);
    setTimeout(() => {
      editCausedByNewAttribute = false;
    }, 200);
  };
  return (
    <div className="button">
      <GlobalHotKeys
        allowChanges
        keyMap={{ NEW_FIELD: 'a' }}
        handlers={{
          NEW_FIELD: handler,
        }}
      />
      <Button
        startIcon={<AddIcon />}
        style={{
          marginBottom: '10px',
        }}
        size="small"
        variant="contained"
        onClick={handler}
      >
        New attribute
      </Button>
    </div>
  );
};

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
      connectDragPreview: connect.dragPreview(),
      isDragging: monitor.isDragging(),
    }),
  )(ListItemEdit),
);

const UnionEdit = ({ typeGraph, onChange, types }: any) => {
  const selectedValues = types.map(t => t.type.name);
  const possibleValues = Object.values(typeGraph.nodes)
    .filter((n: any) => n.kind === 'OBJECT' && n.name !== FAKE_ROOT_ID)
    .map((n: any) => n.name);

  return (
    <div className="item">
      <FormControl style={{ width: '100%' }} error={!selectedValues.length}>
        <InputLabel shrink>Settings</InputLabel>
        <Select
          multiple
          value={selectedValues}
          onChange={e => onChange(e.target.value)}
          input={<Input />}
          renderValue={(selected: string[]) => selected.join(', ')}
          style={{ width: '100%' }}
        >
          {possibleValues.map(s => (
            <MenuItem key={s} value={s}>
              <Checkbox checked={selectedValues.includes(s)} color="primary" />
              <ListItemText primary={s} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
};
