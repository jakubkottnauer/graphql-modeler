import { isNode } from '../../graph';

import * as React from 'react';
import TypeList from './TypeList';
import TypeDoc from './TypeDoc';
import FocusTypeButton from './FocusTypeButton';
import TypeInfoPopover from './TypeInfoPopover';
import OtherSearchResults from './OtherSearchResults';
import SearchBox from '../utils/SearchBox';
import ImportExportDialog from './DocExplorer/ImportExportDialog';
import ManageSchemasDialog from './DocExplorer/ManageSchemasDialog';
import './DocExplorer.css';
import { Button } from '@material-ui/core';

type DocExplorerProps = {
  typeGraph: any;
  createEmptySchema: () => void;
  selectedTypeID: string;
  selectedEdgeID: string;
  saveToSvg: () => void;
  onFocusNode: (id: string) => void;
  onSelectNode: (id: string) => void;
  onSelectEdge: (id: string) => void;
  selectedSchema: string | null;
  onEditType: (typeId: string, typeData: any) => void;
  onDeleteType: (typeId) => void;
  scalars: string[];
  updateSchema: (schema: string | null, isNew?: boolean) => void;
  switchToSchema: (schemaName: string | null) => void;
};

const initialNav = { title: 'Settings', type: null, searchValue: null };

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
    const {
      createEmptySchema,
      updateSchema,
      typeGraph,
      saveToSvg,
      selectedSchema,
      switchToSchema,
    } = this.props;

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

    const name = currentNav.type ? currentNav.type.name : 'Data Model';
    return (
      <div className="type-doc" key={navStack.length}>
        <p>Current model: {selectedSchema || 'default model'}</p>
        <NewModelButton createEmptySchema={createEmptySchema} />
        <ImportExportDialog
          updateSchema={updateSchema}
          saveToSvg={saveToSvg}
          selectedSchema={selectedSchema}
        />
        <ManageSchemasDialog selectedSchema={selectedSchema} switchToSchema={switchToSchema} />
        {this.renderNavigation(previousNav, currentNav)}
        <div className="scroll-area">
          {!currentNav.type && (
            <SearchBox
              placeholder={`Search ${name}...`}
              value={currentNav.searchValue}
              onSearch={this.handleSearch}
            />
          )}
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

const NewModelButton = ({
  createEmptySchema,
}: {
  createEmptySchema: DocExplorerProps['createEmptySchema'];
}) => {
  return <Button onClick={createEmptySchema}>New model</Button>;
};
