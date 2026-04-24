import { Box, Button, Stack, TextField, Tooltip, Typography } from '@mui/material';

interface PdfColorPaletteProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}

const PDF_ACCENT_COLORS = [
  { label: 'Розовый', value: '#D4146A' },
  { label: 'Синий', value: '#0B5CAD' },
  { label: 'Бирюза', value: '#239C8C' },
  { label: 'Зелёный', value: '#1F8A4C' },
  { label: 'Золото', value: '#C7922B' },
  { label: 'Графит', value: '#1D1D1F' },
  { label: 'Красный', value: '#C62828' },
  { label: 'Фиолетовый', value: '#6D4AFF' },
];

function normalizeColor(value: string) {
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : '#D4146A';
}

export default function PdfColorPalette({
  value,
  onChange,
  disabled = false,
  label = 'Акцент PDF',
}: PdfColorPaletteProps) {
  const normalizedValue = normalizeColor(value);

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
          {label}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
          {normalizedValue}
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
        {PDF_ACCENT_COLORS.map((color) => {
          const active = normalizedValue.toLowerCase() === color.value.toLowerCase();

          return (
            <Tooltip key={color.value} title={color.label}>
              <Button
                aria-label={color.label}
                disabled={disabled}
                onClick={() => onChange(color.value)}
                sx={{
                  minWidth: 34,
                  width: 34,
                  height: 34,
                  p: 0,
                  borderRadius: '50%',
                  bgcolor: color.value,
                  border: active ? '3px solid #111' : '2px solid rgba(0,0,0,0.08)',
                  boxShadow: active ? '0 0 0 3px rgba(0,0,0,0.08)' : 'none',
                  '&:hover': {
                    bgcolor: color.value,
                    transform: 'translateY(-1px)',
                  },
                }}
              />
            </Tooltip>
          );
        })}
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <TextField
          type="color"
          size="small"
          label="Палитра"
          value={normalizedValue}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          sx={{ width: { xs: '100%', sm: 110 } }}
        />
        <TextField
          size="small"
          label="HEX"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          fullWidth
          helperText="Сначала выбери основной цвет или задай свой через палитру."
        />
      </Stack>
    </Box>
  );
}
