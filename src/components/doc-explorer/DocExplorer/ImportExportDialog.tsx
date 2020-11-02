import * as React from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  TextareaAutosize,
  DialogContent,
  DialogActions,
  Typography,
} from '@material-ui/core';
import SaveIcon from '@material-ui/icons/Save';
import { saveAs } from 'file-saver';

type Props = {
  saveToSvg: () => void;
  updateSchema: (schema: string | null, isNew?: boolean) => void;
  selectedSchema: string | null;
};

const ImportExportDialog = ({
  updateSchema,
  dialogShown,
  saveToSvg,
  setDialogShown,
  selectedSchema,
}: {
  updateSchema: Props['updateSchema'];
  dialogShown: boolean;
  setDialogShown: (shown: boolean) => void;
  saveToSvg: Props['saveToSvg'];
  selectedSchema: Props['selectedSchema'];
}) => {
  const [schema, setSchema] = React.useState('');

  React.useEffect(() => {
    const schemas = localStorage.getItem('schemas');
    if (selectedSchema && schemas) {
      const parsedSchemas = JSON.parse(schemas);
      const schema = parsedSchemas.find(s => s.name === selectedSchema).schema;
      setSchema(schema);
    }
  }, []);

  const saveToTxt = () => {
    const blob = new Blob([schema], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, 'model.txt');
  };

  return (
    <Dialog open={dialogShown} onClose={() => setDialogShown(false)} maxWidth="lg" fullWidth>
      <DialogTitle>Import / export model</DialogTitle>
      <DialogContent>
        {selectedSchema && (
          <Typography variant="body1" gutterBottom>
            Below is the textual representation of the model (
            <b>{selectedSchema || 'default model'}</b>). You can make changes to it, export it or
            simply copy and send it somebody else.
          </Typography>
        )}
        {!selectedSchema && (
          <Typography variant="body1" gutterBottom>
            Textual representation of the default model currently cannot be displayed. Please create
            a new model first.
          </Typography>
        )}
        {selectedSchema && (
          <TextareaAutosize
            value={schema}
            rowsMax={50}
            style={{ width: '99%' }}
            onChange={e => setSchema(e.currentTarget.value)}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={saveToSvg} color="primary">
          Export as SVG
        </Button>
        {selectedSchema && (
          <Button onClick={saveToTxt} color="primary">
            Export as TXT
          </Button>
        )}
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
            if (selectedSchema) {
              updateSchema(schema);
            }
            setDialogShown(false);
          }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ImportExportButton = ({ updateSchema, saveToSvg, selectedSchema }: Props) => {
  const [dialogShown, setDialogShown] = React.useState(false);

  return (
    <>
      <Button onClick={() => setDialogShown(true)}>Import / export model</Button>
      {dialogShown && (
        <ImportExportDialog
          updateSchema={updateSchema}
          dialogShown={dialogShown}
          setDialogShown={setDialogShown}
          saveToSvg={saveToSvg}
          selectedSchema={selectedSchema}
        />
      )}
    </>
  );
};

export default ImportExportButton;
