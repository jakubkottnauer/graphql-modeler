import { isNode } from '../../graph';

import * as React from 'react';
import TypeList from './TypeList';
import TypeDoc from './TypeDoc';
import FocusTypeButton from './FocusTypeButton';
import TypeInfoPopover from './TypeInfoPopover';
import OtherSearchResults from './OtherSearchResults';
import SearchBox from '../utils/SearchBox';

import './DocExplorer.css';
import {
  Button,
  Dialog,
  DialogTitle,
  TextareaAutosize,
  DialogContent,
  DialogActions,
} from '@material-ui/core';
import SaveIcon from '@material-ui/icons/Save';

interface DocExplorerProps {
  typeGraph: any;
  selectedTypeID: string;
  selectedEdgeID: string;

  onFocusNode: (id: string) => void;
  onSelectNode: (id: string) => void;
  onSelectEdge: (id: string) => void;

  onEditEdge: (
    typeId: string,
    edgeId: string,
    newEdgeId: string,
    newDescription: string,
    newDataType: string,
  ) => void;
  onEditType: (typeId: string, typeData: any) => void;
  onDeleteType: (typeId) => void;
  scalars: string[];
  updateSchema: (schema: string | null) => void;
}

const initialNav = { title: 'Type List', type: null, searchValue: null };

export default class DocExplorer extends React.Component<DocExplorerProps> {
  state = { navStack: [initialNav], typeForInfoPopover: null };

  static getDerivedStateFromProps(props, state) {
    const { selectedTypeID, typeGraph } = props;

    const { navStack } = state;
    const lastNav = navStack[navStack.length - 1];
    const lastTypeID = lastNav.type ? lastNav.type.id : null;

    // if type with the lastTypeID no longer exists -> modify navstack because it has been renamed
    if (selectedTypeID && lastTypeID && !typeGraph.nodes[lastTypeID]) {
      const type = typeGraph.nodes[selectedTypeID];
      const newNavStack = [...navStack];
      newNavStack[newNavStack.length - 1] = { title: type.name, type, searchValue: null };

      return { navStack: newNavStack, typeForInfoPopover: null };
    }

    if (selectedTypeID !== lastTypeID) {
      if (selectedTypeID == null) {
        return { navStack: [initialNav], typeForInfoPopover: null };
      }
      const type = typeGraph.nodes[selectedTypeID];
      const newNavStack = [...navStack, { title: type.name, type, searchValue: null }];

      return { navStack: newNavStack, typeForInfoPopover: null };
    }

    // something in the typegraph has been edited -> modify navstack
    if (typeGraph && typeGraph.nodes[selectedTypeID]) {
      const type = typeGraph.nodes[selectedTypeID];
      const newNavStack = [...navStack];
      newNavStack[newNavStack.length - 1] = { title: type.name, type, searchValue: null };

      return { navStack: newNavStack, typeForInfoPopover: null };
    }

    return null;
  }

  render() {
    const { updateSchema, typeGraph } = this.props;

    if (!typeGraph) {
      return (
        <div className="type-doc" key={0}>
          <span className="loading"> Loading... </span>;
        </div>
      );
    }

    const { navStack } = this.state;
    const previousNav = navStack[navStack.length - 2];
    const currentNav = navStack[navStack.length - 1];

    const name = currentNav.type ? currentNav.type.name : 'Schema';
    return (
      <div className="type-doc" key={navStack.length}>
        <NewModelButton updateSchema={updateSchema} />
        <ImportExportButton updateSchema={updateSchema} />
        <RevertChanges updateSchema={updateSchema} />
        {this.renderNavigation(previousNav, currentNav)}
        <div className="scroll-area">
          <SearchBox
            placeholder={`Search ${name}...`}
            value={currentNav.searchValue}
            onSearch={this.handleSearch}
          />
          {this.renderCurrentNav(currentNav)}
          {currentNav.searchValue && (
            <OtherSearchResults
              typeGraph={typeGraph}
              withinType={currentNav.type}
              searchValue={currentNav.searchValue}
              onTypeLink={this.handleTypeLink}
              onFieldLink={this.handleFieldLink}
            />
          )}
        </div>
        {currentNav.type && (
          <TypeInfoPopover
            type={this.state.typeForInfoPopover}
            onChange={type => this.setState({ typeForInfoPopover: type })}
          />
        )}
      </div>
    );
  }

  renderCurrentNav(currentNav) {
    const { typeGraph, selectedEdgeID, onSelectEdge, onFocusNode } = this.props;

    if (currentNav.type) {
      return (
        <TypeDoc
          selectedType={currentNav.type}
          selectedEdgeID={selectedEdgeID}
          typeGraph={typeGraph}
          filter={currentNav.searchValue}
          onTypeLink={this.handleTypeLink}
          onSelectEdge={onSelectEdge}
          onEditType={this.props.onEditType}
          scalars={this.props.scalars}
          onDeleteType={this.props.onDeleteType}
        />
      );
    }

    return (
      <TypeList
        typeGraph={typeGraph}
        filter={currentNav.searchValue}
        onTypeLink={this.handleTypeLink}
        onFocusType={type => onFocusNode(type.id)}
        onEditType={this.props.onEditType}
      />
    );
  }

  renderNavigation(previousNav, currentNav) {
    const { onFocusNode } = this.props;
    if (previousNav) {
      return (
        <div className="doc-navigation">
          <span className="back" onClick={this.handleNavBackClick}>
            {previousNav.title}
          </span>
          <span className="active" title={currentNav.title}>
            {currentNav.title}
            <FocusTypeButton onClick={() => onFocusNode(currentNav.type.id)} />
          </span>
        </div>
      );
    }

    return (
      <div className="doc-navigation">
        <span className="header">{currentNav.title}</span>
      </div>
    );
  }

  handleSearch = value => {
    const navStack = this.state.navStack.slice();
    const currentNav = navStack[navStack.length - 1];
    navStack[navStack.length - 1] = { ...currentNav, searchValue: value };
    this.setState({ navStack });
  };

  handleTypeLink = type => {
    let { onFocusNode, onSelectNode } = this.props;

    if (isNode(type)) {
      onFocusNode(type.id);
      onSelectNode(type.id);
    } else {
      this.setState({ typeForInfoPopover: type });
    }
  };

  handleFieldLink = (field, type) => {
    let { onFocusNode, onSelectNode, onSelectEdge } = this.props;

    onFocusNode(type.id);
    onSelectNode(type.id);
    // wait for docs panel to rerender with new edges
    setTimeout(() => onSelectEdge(field.id));
  };

  handleNavBackClick = () => {
    const { onFocusNode, onSelectNode } = this.props;
    const newNavStack = this.state.navStack.slice(0, -1);
    const newCurrentNode = newNavStack[newNavStack.length - 1];

    this.setState({ navStack: newNavStack, typeForInfoPopover: null });

    if (newCurrentNode.type == null) {
      return onSelectNode(null);
    }

    onFocusNode(newCurrentNode.type.id);
    onSelectNode(newCurrentNode.type.id);
  };
}

const NewModelButton = ({ updateSchema }: { updateSchema: (schema: string | null) => void }) => {
  const emptyModel = `
  schema {
    query: root
  }

  type root {
    value: String
  }
  `;
  return <Button onClick={() => updateSchema(emptyModel)}>New model</Button>;
};

const RevertChanges = ({ updateSchema }: { updateSchema: (schema: string | null) => void }) => {
  return <Button onClick={() => updateSchema(null)}>Revert my changes</Button>;
};

const ImportExportDialog = ({
  updateSchema,
  dialogShown,
  setDialogShown,
}: {
  updateSchema: (schema: string) => void;
  dialogShown: boolean;
  setDialogShown: (shown: boolean) => void;
}) => {
  const [schema, setSchema] = React.useState('');

  React.useEffect(() => {
    const persistedSchema = localStorage.getItem('schema');
    if (persistedSchema) {
      setSchema(persistedSchema);
    }
  }, []);

  return (
    <Dialog open={dialogShown} onClose={() => setDialogShown(false)} maxWidth="lg" fullWidth>
      <DialogTitle>Import / export model</DialogTitle>
      <DialogContent>
        <TextareaAutosize
          value={schema}
          rowsMax={50}
          style={{ width: '99%' }}
          onChange={e => {
            setSchema(e.currentTarget.value);
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            const originalContent = document.getElementsByClassName('viewport')[0].childNodes[0];
            const content = originalContent.cloneNode(true);
            // remove pan/zoom controls
            content.removeChild(content.childNodes[2]);
            const a = document.createElement('a');
            // @ts-ignore
            a.href = 'data:image/svg+xml;utf8,' + escape(content.outerHTML);
            a.download = 'model.svg';
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }}
          color="primary"
        >
          Export as SVG
        </Button>
        <div style={{ flex: '1 0 0' }} />
        <Button onClick={() => setDialogShown(false)} color="primary">
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          size="small"
          startIcon={<SaveIcon />}
          onClick={() => {
            updateSchema(schema);
            setDialogShown(false);
          }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ImportExportButton = ({
  updateSchema,
}: {
  updateSchema: (schema: string | null) => void;
}) => {
  const [dialogShown, setDialogShown] = React.useState(false);

  return (
    <>
      <Button onClick={() => setDialogShown(true)}>Import / export model</Button>
      {dialogShown && (
        <ImportExportDialog
          updateSchema={updateSchema}
          dialogShown={dialogShown}
          setDialogShown={setDialogShown}
        />
      )}
    </>
  );
};
