import {
  introspectionQuery,
  buildClientSchema,
  printSchema,
  introspectionFromSchema,
  buildSchema,
  IntrospectionQuery,
} from 'graphql/utilities';
import * as _ from 'lodash';
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
    const persistedSchema = localStorage.getItem('schema');
    let introspection: IntrospectionQuery | null = null;
    if (persistedSchema) {
      introspection = introspectionFromSchema(buildSchema(persistedSchema));
    }

    this.fetchIntrospection({ data: introspection });
  }

  fetchIntrospection(introspection = { data: null }) {
    const displayOptions = normalizeDisplayOptions(this.props.displayOptions);

    if (introspection.data) {
      this.updateIntrospection(introspection, displayOptions);
      return;
    }

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

    if (introspectionData) {
      const graphqlSchemaObj = buildClientSchema(introspectionData.data);
      const sdlString = printSchema(graphqlSchemaObj);
      localStorage.setItem('schema', sdlString);
    }

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

  handleEditType = (typeId: string, typeData: any) => {
    if (!typeId) return;
    const typeName = typeId.split('::')[1];
    const data = _.cloneDeep(this.state.introspectionData);
    const typeIndex = data.data.__schema.types.findIndex(
      t => t.kind === 'OBJECT' && t.name === typeName,
    );
    if (typeIndex > -1) {
      // edit existing type
      data.data.__schema.types[typeIndex].name = typeData.name;
      // update fields
      const fieldKeys = Object.keys(typeData.fields);
      data.data.__schema.types[typeIndex].fields = data.data.__schema.types[typeIndex].fields.map(
        oldField => {
          const newField = typeData.fields[oldField.name];
          if (newField) {
            //existing field has been renamed
            console.log(' old new', oldField, newField);
            const field = _.cloneDeep(oldField);
            field.name = newField.name;
            field.description = newField.description;
            field.type.ofType.name = newField.type.name;
            return field;
          } else {
            // a field has been deleted
            return null;
          }
        },
      );
      // remove deleted fields
      data.data.__schema.types[typeIndex].fields = data.data.__schema.types[
        typeIndex
      ].fields.filter(x => x);
      // process new fields
      for (const newFieldKey of fieldKeys) {
        if (!data.data.__schema.types[typeIndex].fields.find(x => x.name === newFieldKey)) {
          // a new field has been added -> add it to typegraph
          const newField = typeData.fields[newFieldKey];
          const field = _.cloneDeep(data.data.__schema.types[typeIndex].fields[0]);
          field.name = newField.name;
          field.description = newField.description;
          field.type.ofType.name = newField.type.name;
          data.data.__schema.types[typeIndex].fields.push(field);
        }
      }

      // traverse the graph and change the type's name everywhere
      for (let i = 0; i < data.data.__schema.types.length; i++) {
        if (!data.data.__schema.types[i].fields) {
          continue;
        }
        for (let j = 0; j < data.data.__schema.types[i].fields.length; j++) {
          if (data.data.__schema.types[i].fields[j].type.name == typeName) {
            data.data.__schema.types[i].fields[j].type.name = typeData.name;
          }
        }
      }

      // update description
      data.data.__schema.types[typeIndex].description = typeData.description;

      // select the modified type as current type
      this.setState({ selectedTypeID: 'TYPE::' + typeData.name });
    } else {
      // // create a new type
      data.data.__schema.types = [...data.data.__schema.types, typeData];

      // update Root
      data.data.__schema.types[0].fields = [
        ...data.data.__schema.types[0].fields,
        {
          name: typeData.name.toLowerCase(),
          description: null,
          args: [
            {
              name: 'id',
              description: null,
              type: { kind: 'SCALAR', name: 'ID', ofType: null },
              defaultValue: null,
            },
          ],
          type: {
            kind: 'OBJECT',
            name: typeData.name,
            ofType: null,
          },
        },
      ];
    }
    console.log('updated data', data);
    console.log(JSON.stringify(data));
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
