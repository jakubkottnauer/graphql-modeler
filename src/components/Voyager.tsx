import { introspectionQuery } from 'graphql/utilities';

import { getSchema, extractTypeId } from '../introspection';
import { SVGRender, getTypeGraph } from '../graph/';
import { WorkerCallback } from '../utils/types';

import * as React from 'react';
import * as PropTypes from 'prop-types';
import { theme } from './MUITheme';
import { MuiThemeProvider } from '@material-ui/core/styles';

import GraphViewport from './GraphViewport';
import DocExplorer from './doc-explorer/DocExplorer';
import PoweredBy from './utils/PoweredBy';
import Settings from './settings/Settings';

import './Voyager.css';
import './viewport.css';

type IntrospectionProvider = (query: string) => Promise<any>;

export interface VoyagerDisplayOptions {
  rootType?: string;
  skipRelay?: boolean;
  skipDeprecated?: boolean;
  showLeafFields?: boolean;
  sortByAlphabet?: boolean;
  hideRoot?: boolean;
}

const defaultDisplayOptions = {
  rootType: undefined,
  skipRelay: true,
  skipDeprecated: true,
  sortByAlphabet: false,
  showLeafFields: true,
  hideRoot: false,
};

function normalizeDisplayOptions(options) {
  return options != null ? { ...defaultDisplayOptions, ...options } : defaultDisplayOptions;
}

export interface VoyagerProps {
  introspection: IntrospectionProvider | Object;
  displayOptions?: VoyagerDisplayOptions;
  hideDocs?: boolean;
  hideSettings?: boolean;
  workerURI?: string;
  loadWorker?: WorkerCallback;

  children?: React.ReactNode;
}

export default class Voyager extends React.Component<VoyagerProps> {
  static propTypes = {
    introspection: PropTypes.oneOfType([PropTypes.func.isRequired, PropTypes.object.isRequired])
      .isRequired,
    displayOptions: PropTypes.shape({
      rootType: PropTypes.string,
      skipRelay: PropTypes.bool,
      skipDeprecated: PropTypes.bool,
      sortByAlphabet: PropTypes.bool,
      hideRoot: PropTypes.bool,
      showLeafFields: PropTypes.bool,
    }),
    hideDocs: PropTypes.bool,
    hideSettings: PropTypes.bool,
    workerURI: PropTypes.string,
    loadWorker: PropTypes.func,
  };

  state = {
    introspectionData: null,
    schema: null,
    typeGraph: null,
    displayOptions: defaultDisplayOptions,
    selectedTypeID: null,
    selectedEdgeID: null,
  };

  svgRenderer: SVGRender;
  viewportRef = React.createRef<GraphViewport>();
  introspectionPromise = null;

  constructor(props) {
    super(props);
    this.svgRenderer = new SVGRender(this.props.workerURI, this.props.loadWorker);
  }

  componentDidMount() {
    this.fetchIntrospection();
  }

  fetchIntrospection() {
    const displayOptions = normalizeDisplayOptions(this.props.displayOptions);

    if (typeof this.props.introspection !== 'function') {
      this.updateIntrospection(this.props.introspection, displayOptions);
      return;
    }

    let promise = this.props.introspection(introspectionQuery);

    if (!isPromise(promise)) {
      throw new Error('SchemaProvider did not return a Promise for introspection.');
    }

    this.setState({
      introspectionData: null,
      schema: null,
      typeGraph: null,
      displayOptions: null,
      selectedTypeID: null,
      selectedEdgeID: null,
    });

    this.introspectionPromise = promise;
    promise.then(introspectionData => {
      if (promise === this.introspectionPromise) {
        this.introspectionPromise = null;
        this.updateIntrospection(introspectionData, displayOptions);
      }
    });
  }

  updateIntrospection(introspectionData, displayOptions) {
    const schema = getSchema(
      introspectionData,
      displayOptions.sortByAlphabet,
      displayOptions.skipRelay,
      displayOptions.skipDeprecated,
    );
    const typeGraph = getTypeGraph(schema, displayOptions.rootType, displayOptions.hideRoot);
    console.log('new typegraph', typeGraph);
    this.setState({
      introspectionData,
      schema,
      typeGraph,
      displayOptions,
      // selectedTypeID: null,
      // selectedEdgeID: null,
    });
  }

  componentDidUpdate(prevProps: VoyagerProps) {
    if (this.props.introspection !== prevProps.introspection) {
      this.fetchIntrospection();
    } else if (this.props.displayOptions !== prevProps.displayOptions) {
      this.updateIntrospection(
        this.state.introspectionData,
        normalizeDisplayOptions(this.props.displayOptions),
      );
    }

    if (this.props.hideDocs !== prevProps.hideDocs) {
      this.viewportRef.current.resize();
    }
  }

  render() {
    const { hideDocs = false, hideSettings = false } = this.props;

    return (
      <MuiThemeProvider theme={theme}>
        <div className="graphql-voyager">
          {!hideDocs && this.renderPanel()}
          {!hideSettings && this.renderSettings()}
          {this.renderGraphViewport()}
        </div>
      </MuiThemeProvider>
    );
  }

  renderPanel() {
    const children = React.Children.toArray(this.props.children);
    const panelHeader = children.find(
      (child: React.ReactElement<any>) => child.type === Voyager.PanelHeader,
    );

    const { typeGraph, selectedTypeID, selectedEdgeID } = this.state;
    const onFocusNode = id => this.viewportRef.current.focusNode(id);

    const scalars = this.state.introspectionData
      ? this.state.introspectionData.data.__schema.types
          .filter(x => x.kind === 'SCALAR')
          .map(x => x.name)
      : [];
    const types = this.state.typeGraph
      ? Object.values(this.state.typeGraph.nodes).map((x: any) => x.name)
      : [];
    return (
      <div className="doc-panel">
        <div className="contents">
          {panelHeader}
          <DocExplorer
            typeGraph={typeGraph}
            selectedTypeID={selectedTypeID}
            selectedEdgeID={selectedEdgeID}
            onFocusNode={onFocusNode}
            onSelectNode={this.handleSelectNode}
            onSelectEdge={this.handleSelectEdge}
            onEditEdge={this.handleEditEdge}
            onEditType={this.handleEditType}
            scalars={[...scalars, ...types]}
          />
          <PoweredBy />
        </div>
      </div>
    );
  }

  renderSettings() {
    const { schema, displayOptions } = this.state;

    if (schema == null) return null;

    return (
      <Settings
        schema={schema}
        options={displayOptions}
        onChange={this.handleDisplayOptionsChange}
      />
    );
  }

  renderGraphViewport() {
    const { displayOptions, typeGraph, selectedTypeID, selectedEdgeID } = this.state;

    return (
      <GraphViewport
        svgRenderer={this.svgRenderer}
        typeGraph={typeGraph}
        displayOptions={displayOptions}
        selectedTypeID={selectedTypeID}
        selectedEdgeID={selectedEdgeID}
        onSelectNode={this.handleSelectNode}
        onSelectEdge={this.handleSelectEdge}
        ref={this.viewportRef}
      />
    );
  }

  handleDisplayOptionsChange = delta => {
    const displayOptions = { ...this.state.displayOptions, ...delta };
    this.updateIntrospection(this.state.introspectionData, displayOptions);
  };

  handleSelectNode = selectedTypeID => {
    if (selectedTypeID !== this.state.selectedTypeID) {
      this.setState({ selectedTypeID, selectedEdgeID: null });
    }
  };

  handleSelectEdge = selectedEdgeID => {
    if (selectedEdgeID === this.state.selectedEdgeID) {
      // deselect if click again
      this.setState({ selectedEdgeID: null });
    } else {
      const selectedTypeID = extractTypeId(selectedEdgeID);
      this.setState({ selectedTypeID, selectedEdgeID });
    }
  };

  handleEditEdge = (typeId, edgeId, newEdgeId, newDescription, newDataType) => {
    if (!typeId) return;
    const typeName = typeId.split('::')[1];
    const fieldName = edgeId;
    const data = { ...this.state.introspectionData };
    //FIELD::Film::director

    const typeIndex = data.data.__schema.types.findIndex(
      t => t.kind === 'OBJECT' && t.name === typeName,
    );
    const fieldIndex = data.data.__schema.types[typeIndex].fields.findIndex(
      f => f.name === fieldName,
    );

    if (fieldIndex > -1) {
      // edit existing property
      //@ts-ignore
      data.data.__schema.types[typeIndex].fields[fieldIndex].description = newDescription;
      //@ts-ignore
      data.data.__schema.types[typeIndex].fields[fieldIndex].name = newEdgeId;
      //@ts-ignore
      data.data.__schema.types[typeIndex].fields[fieldIndex].type.name = newDataType;
    } else {
      // create a new property
      data.data.__schema.types[typeIndex].fields = [
        ...data.data.__schema.types[typeIndex].fields,
        {
          name: 'NEW',
          description: newDescription,
          args: [],
          type: { kind: 'SCALAR', name: newDataType, ofType: null },
          isDeprecated: false,
          deprecationReason: null,
        },
      ];
    }
    //@ts-ignore
    this.updateIntrospection(data, this.state.displayOptions);
  };

  handleEditType = (typeId: string, newTypeId: string, newDescription: string) => {
    if (!typeId) return;
    const typeName = typeId.split('::')[1];
    const data = { ...this.state.introspectionData };
    const typeIndex = data.data.__schema.types.findIndex(
      t => t.kind === 'OBJECT' && t.name === typeName,
    );
    if (typeIndex > -1) {
      // edit existing type
    } else {
      // create a new type
      data.data.__schema.types = [
        ...data.data.__schema.types,
        {
          kind: 'OBJECT',
          name: newTypeId,
          description: newDescription,
          fields: [
            {
              name: 'id',
              description: 'new field',
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: { kind: 'SCALAR', name: 'ID', ofType: null },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [{ kind: 'INTERFACE', name: 'Node', ofType: null }],
          enumValues: null,
          possibleTypes: null,
        },
      ];

      // update Root
      data.data.__schema.types[0].fields = [
        ...data.data.__schema.types[0].fields,
        {
          name: newTypeId.toLowerCase(),
          description: null,
          args: [
            {
              name: 'id',
              description: null,
              type: { kind: 'SCALAR', name: 'ID', ofType: null },
              defaultValue: null,
            },
            {
              name: 'vehicleID',
              description: null,
              type: { kind: 'SCALAR', name: 'ID', ofType: null },
              defaultValue: null,
            },
          ],
          type: {
            kind: 'OBJECT',
            name: newTypeId,
            ofType: null,
          },
        },
      ];
    }
    console.log('updated data', data);
    //@ts-ignore
    this.updateIntrospection(data, this.state.displayOptions);
  };

  static PanelHeader = props => {
    return props.children || null;
  };
}

// Duck-type promise detection.
function isPromise(value) {
  return typeof value === 'object' && typeof value.then === 'function';
}
