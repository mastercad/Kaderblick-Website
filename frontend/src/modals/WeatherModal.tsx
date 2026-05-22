import { Grid } from '@mui/material';
import React, { useEffect, useState } from 'react';
import {
  Typography,
  CircularProgress,
  Alert,
  Box,
  Card,
  CardContent
} from '@mui/material';
import { WeatherDisplay } from '../components/WeatherIcons';
import { apiJson } from '../utils/api';
import BaseModal from './BaseModal';

interface WeatherModalProps {
  open: boolean;
  onClose: () => void;
  eventId: number | null;
}

interface DailyWeatherData {
  time: string[];
  weathercode: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  apparent_temperature_max: number[];
  apparent_temperature_min: number[];
  sunrise: string[];
  sunset: string[];
  precipitation_sum: number[];
  windspeed_10m_max: number[];
  windgusts_10m_max: number[];
  uv_index_max: number[];
  wind_speed_10m_max: number[];
  wind_gusts_10m_max: number[];
  cloudcover_mean: number[];
}

interface HourlyWeatherData {
  time: { [key: string]: string };
  temperature_2m: { [key: string]: number };
  apparent_temperature: { [key: string]: number };
  precipitation: { [key: string]: number };
  precipitation_probability: { [key: string]: number };
  wind_speed_10m: { [key: string]: number };
  wind_gusts_10m: { [key: string]: number };
  wind_direction_10m: { [key: string]: number };
  uv_index: { [key: string]: number };
  cloudcover: { [key: string]: number };
  relative_humidity_2m: { [key: string]: number };
  pressure_msl: { [key: string]: number };
  weathercode: { [key: string]: number };
}

interface WeatherData {
  dailyWeatherData: DailyWeatherData;
  hourlyWeatherData: HourlyWeatherData;
}

const WeatherModal: React.FC<WeatherModalProps> = ({ open, onClose, eventId }) => {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && eventId) {
      fetchWeatherData(eventId);
    }
  }, [open, eventId]);

  const fetchWeatherData = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const json = await apiJson(`/api/calendar/event/${id}/weather-data`);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Wetterdaten');
    } finally {
      setLoading(false);
    }
  };

  // Hilfsfunktionen für Tagesdaten und Icons
  const getDayData = () => {
    if (!data || !data.dailyWeatherData) return null;
    const d = data.dailyWeatherData;
    return {
      date: d.time[0],
      tempMax: d.temperature_2m_max ? d.temperature_2m_max[0] : 0,
      tempMin: d.temperature_2m_min ? d.temperature_2m_min[0] : 0,
      weatherCode: d.weathercode ? d.weathercode[0] : 0,
      sunrise: d.sunrise ? d.sunrise[0] : '',
      sunset: d.sunset ? d.sunset[0] : '',
      precipitation: d.precipitation_sum ? d.precipitation_sum[0] : 0,
      wind: d.windspeed_10m_max ? d.windspeed_10m_max[0] : 0,
      gusts: d.windgusts_10m_max ? d.windgusts_10m_max[0] : 0,
      uv: d.uv_index_max ? d.uv_index_max[0] : 0,
      clouds: d.cloudcover_mean ? d.cloudcover_mean[0] : 0,
    };
  };

  // Temperaturverlauf für Stunden
  const getHourlyPoints = () => {
    if (!data || !data.hourlyWeatherData) return [];
    const h = data.hourlyWeatherData;
    return Object.keys(h.time).map((key) => ({
      time: h.time[key],
      temp: h.temperature_2m[key],
      weatherCode: h.weathercode ? h.weathercode[key] : 0,
      precipitation: h.precipitation[key],
      clouds: h.cloudcover ? h.cloudcover[key] : 0,
      wind: h.wind_speed_10m ? h.wind_speed_10m[key] : null,
      gusts: h.wind_gusts_10m ? h.wind_gusts_10m[key] : null,
      uv: h.uv_index ? h.uv_index[key] : null,
      humidity: h.relative_humidity_2m ? h.relative_humidity_2m[key] : null,
      pressure: h.pressure_msl ? h.pressure_msl[key] : null,
    }));
  };

  const day = getDayData();
  const hourly = getHourlyPoints();

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      maxWidth="lg"
      title="Wetter Informationen"
    >
      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {day && (
          <Box sx={{ mb: 3 }}>
            <Card sx={{ background: (day.precipitation ?? 0) > 0.5 ? '#90caf9' : (day.clouds ?? 0) > 60 ? '#e0e0e0' : '#ffe082', borderRadius: 4, boxShadow: 3, p: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ fontSize: 64, display: 'flex', alignItems: 'center' }}>
                      <WeatherDisplay code={day.weatherCode} theme="light" />
                    </Box>
                    <Box sx={{ ml: 2 }}>
                      <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{new Date(day.date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</Typography>
                      <Typography variant="body1">{day.sunrise && day.sunset ? `Sonnenaufgang: ${day.sunrise.slice(11)} Uhr, Sonnenuntergang: ${day.sunset.slice(11)} Uhr` : ''}</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ textAlign: 'right', minWidth: 180 }}>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: (day.tempMax ?? 0) > 25 ? '#d84315' : (day.tempMin ?? 0) < 10 ? '#1565c0' : '#333' }}>{day.tempMax}°C / {day.tempMin}°C</Typography>
                    <Typography variant="body2">Regen: {day.precipitation} mm</Typography>
                    <Typography variant="body2">Wind: {day.wind} km/h, Böen: {day.gusts} km/h</Typography>
                    <Typography variant="body2">UV: {day.uv}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Box>
        )}
      {hourly.length > 0 ? (
        <Box sx={{ mb: 2, px: 2 }}>
          <Box sx={{ width: '100%', height: 100, mb: 2, mt: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="100%" height="80" viewBox="0 0 1000 80" preserveAspectRatio="none" style={{ width: '100%', height: 80 }}>
              {(() => {
                const temps = hourly.map(h => h.temp);
                const min = Math.min(...temps);
                const max = Math.max(...temps);
                const n = hourly.length;
                const yOffset = 20; // alles nach unten verschieben
                const points = hourly.map((h, i) => {
                  const x = Math.round((i / (n - 1)) * 1000); // 0 ... 1000
                  const y = yOffset + 40 - ((h.temp - min) / (max - min || 1)) * 30;
                  return `${x},${y}`;
                });
                // Achsenbeschriftungen
                const firstHour = hourly[0];
                const lastHour = hourly[hourly.length - 1];
                return <>
                  <polyline points={points.join(' ')} fill="none" stroke="#1976d2" strokeWidth="3" />
                  {/* Min/Max Temperatur links/rechts */}
                  <text x={0} y={yOffset} fontSize="14" fill="#1976d2" textAnchor="start">{min}°C</text>
                  <text x={1000} y={yOffset} fontSize="14" fill="#1976d2" textAnchor="end">{max}°C</text>
                  {/* Uhrzeiten links/rechts unter der Kurve */}
                  <text x={0} y={yOffset + 55} fontSize="14" fill="#333" textAnchor="start">{new Date(firstHour.time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</text>
                  <text x={1000} y={yOffset + 55} fontSize="14" fill="#333" textAnchor="end">{new Date(lastHour.time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</text>
                </>;
              })()}
            </svg>
            <Typography variant="caption" sx={{ color: '#1976d2', mt: 0.5 }}>Temperaturverlauf</Typography>
          </Box>
          <Grid container spacing={2} sx={{
            justifyContent: "center"
          }}>
            {hourly.map((h, i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
                <Card sx={{ background: h.precipitation > 0.5 ? '#90caf9' : h.clouds > 60 ? '#e0e0e0' : '#ffe082', borderRadius: 3, boxShadow: 2, p: 1 }}>
                  <CardContent sx={{ p: 1 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1 }}>
                      <Box sx={{ fontSize: 32, display: 'flex', alignItems: 'center', mb: 1 }}>
                        <WeatherDisplay code={h.weatherCode} theme="light" />
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: h.temp > 25 ? '#d84315' : h.temp < 10 ? '#1565c0' : '#333' }}>{h.temp}°C</Typography>
                      <Typography variant="body2" sx={{ color: '#333' }}>{new Date(h.time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</Typography>
                    </Box>
                    <Typography variant="body2">Regen: {h.precipitation} mm</Typography>
                    <Typography variant="body2">Wolken: {h.clouds}%</Typography>
                    {h.wind !== null && <Typography variant="body2">Wind: {h.wind} km/h</Typography>}
                    {h.gusts !== null && <Typography variant="body2">Böen: {h.gusts} km/h</Typography>}
                    {h.uv !== null && <Typography variant="body2">UV: {h.uv}</Typography>}
                    {h.humidity !== null && <Typography variant="body2">Luftfeuchte: {h.humidity}%</Typography>}
                    {h.pressure !== null && <Typography variant="body2">Luftdruck: {h.pressure} hPa</Typography>}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ) : (!loading && !error && !data) ? (
        <Typography>Keine Wetterdaten verfügbar.</Typography>
      ) : null}
    </BaseModal>
  );
}

export default WeatherModal;