import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, MenuItem, CircularProgress, Alert, FormControlLabel } from '@mui/material';
import { apiJson } from '../utils/api';
import { Location } from '../types/location';
import BaseModal from './BaseModal';

export type LocationFormValues = {
  id?: number;
  name: string;
  address: string;
  city: string;
  capacity: number | '';
  surfaceTypeId?: number;
  hasFloodlight: boolean;
  facilities: string;
  latitude: number | '';
  longitude: number | '';
};

interface LocationEditModalProps {
  openLocationEditModal: boolean;
  onLocationEditModalClose: () => void;
  onLocationSaved?: (location: Location) => void;
  initialValues?: Partial<LocationFormValues>;
  isEdit?: boolean;
  surfaceTypes?: { id: number; name: string }[];
  onSaved?: (location: Location) => void;
}

const defaultValues: LocationFormValues = {
  name: '',
  address: '',
  city: '',
  capacity: '',
  surfaceTypeId: undefined,
  hasFloodlight: false,
  facilities: '',
  latitude: '',
  longitude: '',
};

const LocationEditModal: React.FC<LocationEditModalProps> = ({ openLocationEditModal, onLocationEditModalClose, onLocationSaved, initialValues, isEdit, onSaved }) => {
  const [values, setValues] = useState<LocationFormValues>(defaultValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [surfaceTypesLoading, setSurfaceTypesLoading] = useState(false);
  const [surfaceTypes, setSurfaceTypes] = useState<{ id: number; name: string }[]>([]);
  const [osmResults, setOsmResults] = useState<OSMResult[]>([]);
  const [osmLoading, setOsmLoading] = useState(false);
  const [osmError, setOsmError] = useState<string | null>(null);
  const fetchCoordinatesFromOSM = async () => {
      setOsmLoading(true);
      setOsmError(null);
      setOsmResults([]);
      try {
      const query = `${values.name} ${values.address} ${values.city}`.trim();
      const url = `/api/locations/osm-coordinates?query=${encodeURIComponent(query)}`;
      const res = await apiJson(url);
      if (Array.isArray(res) && res.length > 0) {
          setOsmResults(res);
          if (res.length === 1) {
          setValues((prev) => ({ ...prev, latitude: Number(res[0].lat), longitude: Number(res[0].lon) }));
          setOsmResults([]);
          }
      } else {
          setOsmError('Keine Ergebnisse gefunden.');
      }
      } catch (e) {
      setOsmError('Fehler bei der OSM-Anfrage');
      } finally {
      setOsmLoading(false);
      }
  };
    
  type OSMResult = { lat: string; lon: string; display_name: string };

  useEffect(() => {
    if (openLocationEditModal) {
      setValues({ ...defaultValues, ...initialValues });
      setError(null);
      setSurfaceTypesLoading(true);
      apiJson('/api/locations')
        .then(res => {
          setSurfaceTypes(Array.isArray(res.surfaceTypes) ? res.surfaceTypes : []);
        })
        .catch(() => setSurfaceTypes([]))
      .finally(() => setSurfaceTypesLoading(false));
    }
  }, [openLocationEditModal, initialValues]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value, type } = e.target;
      const checked = (e.target as HTMLInputElement).checked;
      setValues((prev) => ({
        ...prev,
        [name]:
          type === 'checkbox' ? checked :
          name === 'latitude' || name === 'longitude' || name === 'capacity' || name === 'surfaceTypeId'
            ? (value === '' ? undefined : Number(value))
            : value,
      }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const url = isEdit && values.id ? `/api/locations/${values.id}` : '/api/locations';
      const method = isEdit && values.id ? 'PUT' : 'POST';
      const res = await apiJson(url, {
        method,
        body: values,
        headers: { 'Content-Type': 'application/json' },
      });

      if (onLocationSaved) onLocationSaved(res.location || res.data || values);
      onLocationEditModalClose();
      onSaved?.(res.location || res.data || values);
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal
      open={openLocationEditModal}
      onClose={onLocationEditModalClose}
      maxWidth="sm"
      title={isEdit ? 'Spielstätte bearbeiten' : 'Neue Spielstätte anlegen'}
    >
      <form id="locationEditForm" onSubmit={handleSubmit}>
        <TextField
            label="Name*"
            name="name"
            value={values.name}
            onChange={handleChange}
            fullWidth
            required
            margin="normal"
            placeholder="z.B. Sportplatz Musterstadt"
            slotProps={{
              htmlInput: { maxLength: 100 }
            }}
          />
          <TextField
            label="Adresse"
            name="address"
            value={values.address}
            onChange={handleChange}
            fullWidth
            margin="normal"
            placeholder="Straße und Hausnummer"
            slotProps={{
              htmlInput: { maxLength: 255 }
            }}
          />
          <TextField
            label="Stadt"
            name="city"
            value={values.city}
            onChange={handleChange}
            fullWidth
            margin="normal"
            placeholder="PLZ und Ort"
            slotProps={{
              htmlInput: { maxLength: 255 }
            }}
          />
          <TextField
            label="Kapazität"
            name="capacity"
            value={values.capacity}
            onChange={handleChange}
            type="number"
            fullWidth
            margin="normal"
            placeholder="z.B. 500"
            slotProps={{
              htmlInput: { min: 0 }
            }}
          />
          <TextField
            label="Ausstattung"
            name="facilities"
            value={values.facilities}
            onChange={handleChange}
            fullWidth
            margin="normal"
            placeholder="z.B. Umkleiden, Duschen, Vereinsheim"
            slotProps={{
              htmlInput: { maxLength: 255 }
            }}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Latitude"
              name="latitude"
              value={values.latitude}
              onChange={handleChange}
              type="number"
              fullWidth
              margin="normal"
              placeholder="z.B. 51.0242345"
            />
            <TextField
              label="Longitude"
              name="longitude"
              value={values.longitude}
              onChange={handleChange}
              type="number"
              fullWidth
              margin="normal"
              placeholder="z.B. 13.6238178"
            />
          </Box>
          <Button
            type="button"
            variant="outlined"
            color="secondary"
            fullWidth
            sx={{ mb: 2, mt: 1 }}
            onClick={fetchCoordinatesFromOSM}
            disabled={osmLoading}
            startIcon={<span className="fas fa-map-marker-alt" />}
          >
            Koordinaten von OpenStreetMap holen
          </Button>
          {osmLoading && <Box sx={{ display: 'flex', justifyContent: 'center', my: 1 }}><CircularProgress size={22} /></Box>}
          {osmError && <Alert severity="warning" sx={{ my: 1 }}>{osmError}</Alert>}
          {osmResults.length > 1 && (
            <Box sx={{ mt: 1 }}>
              <Alert severity="info" sx={{ mb: 1 }}>Mehrere Ergebnisse gefunden. Bitte wählen:</Alert>
              {osmResults.map((r, i) => (
                <Button
                  key={i}
                  variant="outlined"
                  fullWidth
                  sx={{ mb: 1, textAlign: 'left' }}
                  onClick={() => {
                    setValues((prev) => ({ ...prev, latitude: Number(r.lat), longitude: Number(r.lon) }));
                    setOsmResults([]);
                  }}
                >
                  {r.display_name}
                </Button>
              ))}
            </Box>
          )}
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <input
                  type="checkbox"
                  name="hasFloodlight"
                  checked={values.hasFloodlight}
                  onChange={handleChange}
                  style={{ marginRight: 8 }}
                />
              }
              label="Flutlicht"
            />
          </Box>
          {/* Alternativ mit MUI Checkbox:
          <FormControlLabel
            control={
              <Checkbox
                name="hasFloodlight"
                checked={values.hasFloodlight}
                onChange={handleChange}
              />
            }
            label="Flutlicht"
          />
          */}
          <TextField
            select
            label="Belag"
            name="surfaceTypeId"
            value={values.surfaceTypeId}
            onChange={handleChange}
            fullWidth
            margin="normal"
          >
            <MenuItem value="">- bitte wählen -</MenuItem>
            {surfaceTypes.map((type) => (
              <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>
            ))}
          </TextField>
          {error && <Typography color="error" sx={{
            mt: 1
          }}>{error}</Typography>}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
            <Button onClick={onLocationEditModalClose} variant="outlined" color="secondary" disabled={loading}>Abbrechen</Button>
            <Button type="submit" variant="contained" color="primary" disabled={loading}>
              {loading ? <CircularProgress size={22} /> : (isEdit ? 'Speichern' : 'Anlegen')}
            </Button>
          </Box>
        </form>
    </BaseModal>
  );
};

export default LocationEditModal;
