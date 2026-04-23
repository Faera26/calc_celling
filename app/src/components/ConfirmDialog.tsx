import type { ReactNode } from 'react';
import type { ButtonProps } from '@mui/material/Button';
import {
  alpha,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  DeleteOutlineRounded as DeleteOutlineRoundedIcon,
  HelpOutlineRounded as HelpOutlineRoundedIcon,
  WarningAmberRounded as WarningAmberRoundedIcon,
} from '@mui/icons-material';

type ConfirmDialogTone = 'danger' | 'warning' | 'neutral';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: ButtonProps['color'];
  tone?: ConfirmDialogTone;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  children?: ReactNode;
}

function toneIcon(tone: ConfirmDialogTone) {
  if (tone === 'danger') return <DeleteOutlineRoundedIcon fontSize="small" />;
  if (tone === 'warning') return <WarningAmberRoundedIcon fontSize="small" />;
  return <HelpOutlineRoundedIcon fontSize="small" />;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  confirmColor = 'primary',
  tone = 'neutral',
  loading = false,
  onClose,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const paletteColor = tone === 'danger'
    ? theme.palette.error
    : tone === 'warning'
      ? theme.palette.warning
      : theme.palette.primary;

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      fullScreen={fullScreen}
      slotProps={{
        paper: {
          sx: {
            overflow: 'hidden',
            borderRadius: { xs: 0, sm: 4 },
            boxShadow: '0 24px 80px rgba(15, 23, 42, 0.18)',
            border: '1px solid',
            borderColor: alpha(paletteColor.main, 0.16),
          },
        },
      }}
    >
      <DialogTitle sx={{ px: 3, pt: 3, pb: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 2.5,
              color: paletteColor.contrastText,
              background: `linear-gradient(135deg, ${paletteColor.light} 0%, ${paletteColor.main} 100%)`,
              boxShadow: `0 12px 30px ${alpha(paletteColor.main, 0.3)}`,
              flexShrink: 0,
            }}
          >
            {toneIcon(tone)}
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              {title}
            </Typography>
            {description && (
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                {description}
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogTitle>

      {children && (
        <DialogContent sx={{ px: 3, py: 0 }}>
          <Box
            sx={{
              borderRadius: 3,
              border: '1px solid',
              borderColor: alpha(paletteColor.main, 0.16),
              backgroundColor: alpha(paletteColor.main, 0.05),
              px: 2,
              py: 1.5,
            }}
          >
            {children}
          </Box>
        </DialogContent>
      )}

      <DialogActions sx={{ px: 3, pb: 3, pt: children ? 2 : 1.5 }}>
        <Button onClick={onClose} disabled={loading} variant="text">
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          color={confirmColor}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          sx={{ minWidth: 144 }}
        >
          {loading ? 'Выполняю...' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
