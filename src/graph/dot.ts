import { stringifyWrappers } from '../introspection/';
import * as _ from 'lodash';

// memoize existing edges betweens nodes used in focus modus to avoid duplicate edges
let existingEdges = {};
// memoize the existence of a path between two (possibly not adjacent nodes) - used to speed up DFS
let knownPaths = {};

export function getDot(typeGraph, displayOptions): string {
  existingEdges = {};
  knownPaths = {};

  const focusMode = !!displayOptions.focusOn;
  function isNode(type) {
    return typeGraph.nodes[type.id] !== undefined;
  }

  function getEdge(node, field) {
    const intraNodeEdgeId = `"${node.name}" -> "${field.type.name}"`;
    const createEdge =
      !focusMode || !existingEdges[intraNodeEdgeId] || displayOptions.focusOn === node.name;
    existingEdges[intraNodeEdgeId] = true;
    if (
      isNode(field.type) &&
      createEdge &&
      (isReachableFromFocused(node) || node.name === displayOptions.focusOn)
    ) {
      return `
      "${node.name}":"${field.name}" -> "${field.type.name}" [
        id = "${field.id} => ${field.type.id}"
        label = "${node.name}:${field.name}"
      ]`;
    } else if (isNode(field.type) && createEdge) {
      return `
      "${node.name}" -> "${field.type.name}" [
        id = "${node.id} => ${field.type.id}"
        label = "${node.name}:${field.name}"
      ]`;
    }
    return '';
  }

  return (
    typeGraph &&
    `
    digraph {
      graph [
        rankdir = "LR"
      ];
      node [
        fontsize = "16"
        fontname = "helvetica, open-sans"
        shape = "plaintext"
      ];
      edge [
      ];
      ranksep = 2.0
      ${objectValues(
        typeGraph.nodes,
        node => `
        "${node.name}" [
          id = "${node.id}"
          label = ${nodeLabel(node)}
        ]
        ${objectValues(node.fields, field => getEdge(node, field))};
        ${array(
          node.possibleTypes,
          ({ id, type }) => `
          "${node.name}":"${type.name}" -> "${type.name}" [
            id = "${id} => ${type.id}"
            style = "dashed"
          ]
        `,
        )}
        ${array(
          node.derivedTypes,
          ({ id, type }) => `
          "${node.name}":"${type.name}" -> "${type.name}" [
            id = "${id} => ${type.id}"
            style = "dotted"
          ]
        `,
        )}
      `,
      )}
    }
  `
  );

  function nodeLabel(node) {
    const htmlID = HtmlId('TYPE_TITLE::' + node.name);
    const kindLabel =
      node.kind !== 'OBJECT' ? '&lt;&lt;' + node.kind.toLowerCase() + '&gt;&gt;' : '';

    return `
      <<TABLE ALIGN="LEFT" BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="5">
        <TR>
          <TD CELLPADDING="4" ${htmlID}><FONT POINT-SIZE="18">${
      node.name
    }</FONT><BR/>${kindLabel}</TD>
        </TR>
        ${objectValues(node.fields, field => nodeField(field, node))}
        ${possibleTypes(node)}
        ${derivedTypes(node)}
      </TABLE>>
    `;
  }

  /**
   * Returns whether the given node is reachable from the focused node via DFS
   *
   */
  function isReachableFromFocused(node) {
    const focusedOn = displayOptions.focusOn;
    if (!focusedOn) {
      return true;
    }

    const pathId = `${focusedOn}:${node.name}`;
    if (knownPaths.hasOwnProperty(pathId)) {
      return knownPaths[pathId];
    }

    // DFS
    const visited = {};
    const queue = [];
    visited[focusedOn] = true;
    queue.push(focusedOn);
    while (queue.length > 0) {
      const currentName = queue.shift();
      const current = typeGraph.nodes['TYPE::' + currentName];
      if (!current) {
        // it's possible the type isn't in the graph because it's unreachable
        knownPaths[pathId] = false;
        return false;
      }
      for (const f of Object.keys(current.fields)) {
        const currentField = current.fields[f];
        if (currentField.type.kind === 'OBJECT') {
          const typeName = currentField.type.name;
          if (typeName === node.name) {
            knownPaths[pathId] = true;
            return true;
          }
          if (!visited[typeName]) {
            visited[typeName] = true;
            queue.push(typeName);
          }
        }
      }
    }
    knownPaths[pathId] = false;
    return false;
  }

  function canDisplayRow(type, node) {
    if (
      displayOptions.focusOn &&
      displayOptions.focusOn !== node.name &&
      !isReachableFromFocused(node)
    ) {
      return false;
    }
    if (type.kind === 'SCALAR' || type.kind === 'ENUM') {
      return displayOptions.showLeafFields;
    }
    return true;
  }

  function nodeField(field, node) {
    const relayIcon = field.relayType ? TEXT('{R}') : '';
    const deprecatedIcon = field.isDeprecated ? TEXT('{D}') : '';
    const parts = stringifyWrappers(field.typeWrappers).map(TEXT);
    return canDisplayRow(field.type, node)
      ? `
      <TR>
        <TD ${HtmlId(field.id)} ALIGN="LEFT" PORT="${field.name}">
          <TABLE CELLPADDING="0" CELLSPACING="0" BORDER="0">
            <TR>
              <TD ALIGN="LEFT">${field.name}<FONT>  </FONT></TD>
              <TD ALIGN="RIGHT">${deprecatedIcon}${relayIcon}${parts[0]}${field.type.name}${
          parts[1]
        }</TD>
            </TR>
          </TABLE>
        </TD>
      </TR>
    `
      : '';
  }
}

function possibleTypes(node) {
  const possibleTypes = node.possibleTypes;
  if (_.isEmpty(possibleTypes)) {
    return '';
  }
  return `
    <TR>
      <TD>possible settings</TD>
    </TR>
    ${array(
      possibleTypes,
      ({ id, type }) => `
      <TR>
        <TD ${HtmlId(id)} ALIGN="LEFT" PORT="${type.name}">${type.name}</TD>
      </TR>
    `,
    )}
  `;
}

function derivedTypes(node) {
  const derivedTypes = node.derivedTypes;
  if (_.isEmpty(derivedTypes)) {
    return '';
  }
  return `
    <TR>
      <TD>implementations</TD>
    </TR>
    ${array(
      derivedTypes,
      ({ id, type }) => `
      <TR>
        <TD ${HtmlId(id)} ALIGN="LEFT" PORT="${type.name}">${type.name}</TD>
      </TR>
    `,
    )}
  `;
}

function objectValues<X>(object: { [key: string]: X }, stringify: (X, node) => string): string {
  return _.values(object)
    .map(stringify)
    .join('\n');
}

function array<X>(array: [X], stringify: (X) => string): string {
  return array ? array.map(stringify).join('\n') : '';
}

function HtmlId(id) {
  return 'HREF="remove_me_url" ID="' + id + '"';
}

function TEXT(str) {
  if (str === '') return '';
  str = str.replace(/]/, '&#93;');
  return '<FONT>' + str + '</FONT>';
}
