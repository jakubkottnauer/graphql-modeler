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
import FileSaver from 'file-saver';

import * as React from 'react';
import * as PropTypes from 'prop-types';
import { theme } from './MUITheme';
import { MuiThemeProvider } from '@material-ui/core/styles';

import GraphViewport from './GraphViewport';
import DocExplorer from './doc-explorer/DocExplorer';
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
  /* Used when creating an empty schema. */
  defaultSchema?: string;
}

const defaultDisplayOptions = {
  rootType: undefined,
  skipRelay: true,
  skipDeprecated: true,
  sortByAlphabet: false,
  showLeafFields: true,
  hideRoot: false,
  focusOn: undefined,
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
  defaultSchema?: string;
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
            saveToSvg={() => {
              this.svgRenderer.renderSvg(typeGraph, this.state.displayOptions).then(data => {
                FileSaver.saveAs(new Blob([data], { type: 'image/svg+xml' }), 'model.svg');
              });
            }}
            defaultSchema={this.props.defaultSchema}
            typeGraph={typeGraph}
            selectedTypeID={selectedTypeID}
            selectedEdgeID={selectedEdgeID}
            onFocusNode={onFocusNode}
            onSelectNode={this.handleSelectNode}
            onSelectEdge={this.handleSelectEdge}
            onEditType={this.handleEditType}
            onDeleteType={this.handleDeleteType}
            updateSchema={this.updateSchema}
            scalars={[...scalars, ...types]}
          />
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

  updateSchema = (schema: string | null) => {
    if (schema) {
      this.updateIntrospection(
        { data: introspectionFromSchema(buildSchema(schema)) },
        this.state.displayOptions,
      );
    } else {
      this.fetchIntrospection();
    }
    this.setState({ selectedTypeID: null });
  };

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

  handleEditType = (typeId: string, typeData: any) => {
    if (!typeId) return;
    const typeName = typeId.split('::')[1];
    const data = _.cloneDeep(this.state.introspectionData);
    const typeIndex = data.data.__schema.types.findIndex(
      t => t.kind === 'OBJECT' && t.name === typeName,
    );
    const scalars = this.state.introspectionData
      ? this.state.introspectionData.data.__schema.types
          .filter(x => x.kind === 'SCALAR')
          .map(x => x.name)
      : [];
    if (typeIndex > -1) {
      // edit existing type
      data.data.__schema.types[typeIndex].name = typeData.name;

      if (data.data.__schema.queryType.name === typeName) {
        // root node has been renamed
        data.data.__schema.queryType.name = typeData.name;
      }

      // update fields
      const fieldKeys = Object.keys(typeData.fields);
      data.data.__schema.types[typeIndex].fields = data.data.__schema.types[typeIndex].fields.map(
        oldField => {
          const newField = typeData.fields[oldField.name];
          if (newField) {
            //existing field has been renamed
            const field = _.cloneDeep(oldField);
            field.name = newField.name;
            field.description = newField.description;
            field.type = createNestedType(newField.typeWrappers, newField.type.name, scalars);

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
          field.type = createNestedType(newField.typeWrappers, newField.type.name, scalars);
          data.data.__schema.types[typeIndex].fields.push(field);
        }
      }
      // sort fields based on the new order set when editing
      data.data.__schema.types[typeIndex].fields.sort(
        (a, b) =>
          typeData.fields[a.name]?.originalPosition - typeData.fields[b.name]?.originalPosition,
      );
      // traverse the graph and change the type's name everywhere
      replaceTypeWith(data, typeName, typeData.name);
      // update description
      data.data.__schema.types[typeIndex].description = typeData.description;
    } else {
      // // create a new type
      data.data.__schema.types = [...data.data.__schema.types, typeData];

      // update Root
      data.data.__schema.types[0].fields = [
        ...data.data.__schema.types[0].fields,
        {
          name: typeData.name.toLowerCase(),
          description: null,
          args: [],
          type: createNestedType([], typeData.name, scalars),
        },
      ];
    }
    //@ts-ignore
    this.updateIntrospection(data, this.state.displayOptions);

    // select the modified type as current type
    this.setState({ selectedTypeID: 'TYPE::' + typeData.name });
  };

  handleDeleteType = (typeId: string) => {
    if (!typeId) return;
    const typeName = typeId.split('::')[1];
    const data = { ...this.state.introspectionData };

    const typeIndex = data.data.__schema.types.findIndex(
      t => t.kind === 'OBJECT' && t.name === typeName,
    );

    //delete the type itself
    data.data.__schema.types.splice(typeIndex, 1);

    // find dependencies and update them with a scalar
    const scalars = this.state.introspectionData
      ? this.state.introspectionData.data.__schema.types
          .filter(x => x.kind === 'SCALAR')
          .map(x => x.name)
      : [];

    replaceTypeWith(data, typeName, scalars[0]);
    // select the modified type as current type
    this.setState({ selectedTypeID: null });
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

function createNestedType(typeWrappers: string[], typeName: string, scalars: string[]) {
  let finalType = {
    kind: scalars.includes(typeName) ? 'SCALAR' : 'OBJECT',
    name: typeName,
    ofType: null,
  };
  if (typeWrappers.includes('NON_NULL')) {
    finalType = { kind: 'NON_NULL', name: null, ofType: _.cloneDeep(finalType) };
  }
  if (typeWrappers.includes('LIST')) {
    finalType = { kind: 'LIST', name: null, ofType: _.cloneDeep(finalType) };
  }
  return finalType;
}

function replaceTypeWith(data: any, typeToReplace: string, newType: string | null) {
  for (let i = 0; i < data.data.__schema.types.length; i++) {
    if (!data.data.__schema.types[i].fields) {
      continue;
    }
    for (let j = 0; j < data.data.__schema.types[i].fields.length; j++) {
      if (data.data.__schema.types[i].fields[j].type.name == typeToReplace) {
        data.data.__schema.types[i].fields[j].type.name = newType;
      }
      if (data.data.__schema.types[i].fields[j].type?.ofType?.name == typeToReplace) {
        data.data.__schema.types[i].fields[j].type.ofType.name = newType;
      }
    }
  }
}
