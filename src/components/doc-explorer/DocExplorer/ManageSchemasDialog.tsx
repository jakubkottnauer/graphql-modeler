import * as React from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  RadioGroup,
  FormControlLabel,
  Radio,
} from '@material-ui/core';
import SaveIcon from '@material-ui/icons/Save';

type Props = {
  selectedSchema: string | null;
  switchToSchema: (schemaName: string | null) => void;
};

const ManageSchemasDialog = ({
  // updateSchema,
  dialogShown,
  setDialogShown,
  selectedSchema,
  switchToSchema,
}: {
  switchToSchema: Props['switchToSchema'];
  dialogShown: boolean;
  setDialogShown: (shown: boolean) => void;
  selectedSchema: Props['selectedSchema'];
}) => {
  const schemas = localStorage.getItem('schemas');
  const persistedSchemas = (JSON.parse(schemas) || []).map(s => s.name);
  const DEFAULT_MODEL = 'DEFAULT_MODEL';
  const availableSchemas = [DEFAULT_MODEL, ...persistedSchemas];
  const onChange = e => {
    const { value } = e.currentTarget;
    switchToSchema(value === DEFAULT_MODEL ? null : value);
  };
  return (
    <Dialog open={dialogShown} onClose={() => setDialogShown(false)} maxWidth="lg" fullWidth>
      <DialogTitle>Manage models</DialogTitle>
      <DialogContent>
        <RadioGroup value={selectedSchema || DEFAULT_MODEL} onChange={onChange}>
          {availableSchemas.map(s => (
            <FormControlLabel
              key={s}
              value={s}
              control={<Radio color="primary" />}
              label={s === DEFAULT_MODEL ? 'default model' : s}
            />
          ))}
        </RadioGroup>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          size="small"
          startIcon={<SaveIcon />}
          onClick={() => {
            // updateSchema(schema);
            setDialogShown(false);
          }}
        >
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ManageSchemasButton = ({ switchToSchema, selectedSchema }: Props) => {
  const [dialogShown, setDialogShown] = React.useState(false);

  return (
    <>
      <Button onClick={() => setDialogShown(true)}>Manage models</Button>
      {dialogShown && (
        <ManageSchemasDialog
          switchToSchema={switchToSchema}
          dialogShown={dialogShown}
          setDialogShown={setDialogShown}
          selectedSchema={selectedSchema}
        />
      )}
    </>
  );
};

export default ManageSchemasButton;
