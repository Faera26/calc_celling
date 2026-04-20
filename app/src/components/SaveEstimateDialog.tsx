import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import type { EstimateRoomDraft, EstimateSaveDraft, EstimateStatus } from '../types';
import { money } from '../utils';

interface SaveEstimateDialogProps {
  open: boolean;
  cartCount: number;
  total: number;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (draft: EstimateSaveDraft) => void;
}

function emptyRoom(index: number): EstimateRoomDraft {
  return {
    id: crypto.randomUUID(),
    name: `Комната ${index}`,
    area: '',
    perimeter: '',
    corners: '',
    lightPoints: '',
    pipes: '',
    curtainTracks: '',
    niches: '',
    comment: '',
  };
}

function defaultDraft(): EstimateSaveDraft {
  return {
    title: `Смета от ${new Date().toLocaleDateString('ru-RU')}`,
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    objectAddress: '',
    clientComment: '',
    status: 'draft',
    rooms: [emptyRoom(1)],
  };
}

export default function SaveEstimateDialog({
  open,
  cartCount,
  total,
  saving,
  error,
  onClose,
  onSave,
}: SaveEstimateDialogProps) {
  const [draft, setDraft] = useState<EstimateSaveDraft>(() => defaultDraft());

  useEffect(() => {
    if (open) setDraft(defaultDraft());
  }, [open]);

  function updateRoom(roomId: string, patch: Partial<EstimateRoomDraft>) {
    setDraft(prev => ({
      ...prev,
      rooms: prev.rooms.map(room => room.id === roomId ? { ...room, ...patch } : room),
    }));
  }

  function addRoom() {
    setDraft(prev => ({
      ...prev,
      rooms: [...prev.rooms, emptyRoom(prev.rooms.length + 1)],
    }));
  }

  function removeRoom(roomId: string) {
    setDraft(prev => ({
      ...prev,
      rooms: prev.rooms.length > 1 ? prev.rooms.filter(room => room.id !== roomId) : prev.rooms,
    }));
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Сохранить смету</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Alert severity="info">
            Сохраняем клиента, комнаты, параметры потолка, позиции и состав узлов. Потом эту смету можно открыть из раздела “Сметы”.
          </Alert>

          {error && <Alert severity="error">{error}</Alert>}

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Название сметы"
              value={draft.title}
              onChange={(event) => setDraft(prev => ({ ...prev, title: event.target.value }))}
              fullWidth
            />
            <TextField
              select
              label="Статус"
              value={draft.status}
              onChange={(event) => setDraft(prev => ({ ...prev, status: event.target.value as EstimateStatus }))}
              sx={{ minWidth: { md: 190 } }}
            >
              <MenuItem value="draft">Черновик</MenuItem>
              <MenuItem value="sent">Отправлено</MenuItem>
              <MenuItem value="accepted">Принято</MenuItem>
              <MenuItem value="archived">Архив</MenuItem>
            </TextField>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Клиент"
              value={draft.clientName}
              onChange={(event) => setDraft(prev => ({ ...prev, clientName: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Телефон"
              value={draft.clientPhone}
              onChange={(event) => setDraft(prev => ({ ...prev, clientPhone: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Email"
              value={draft.clientEmail}
              onChange={(event) => setDraft(prev => ({ ...prev, clientEmail: event.target.value }))}
              fullWidth
            />
          </Stack>

          <TextField
            label="Адрес объекта"
            value={draft.objectAddress}
            onChange={(event) => setDraft(prev => ({ ...prev, objectAddress: event.target.value }))}
            fullWidth
          />

          <TextField
            label="Комментарий"
            value={draft.clientComment}
            onChange={(event) => setDraft(prev => ({ ...prev, clientComment: event.target.value }))}
            multiline
            minRows={2}
            fullWidth
          />

          <Divider />

          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 1 }}>
            <Box>
              <Typography variant="h6">Комнаты и параметры потолка</Typography>
              <Typography variant="body2" color="text.secondary">
                Эти поля станут основой калькулятора по комнатам.
              </Typography>
            </Box>
            <Button startIcon={<AddIcon />} variant="outlined" onClick={addRoom}>
              Добавить комнату
            </Button>
          </Stack>

          <Stack spacing={2}>
            {draft.rooms.map((room, index) => (
              <Box key={room.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="subtitle1">Комната {index + 1}</Typography>
                  <IconButton color="error" disabled={draft.rooms.length === 1} onClick={() => removeRoom(room.id)}>
                    <DeleteIcon />
                  </IconButton>
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
                  <TextField label="Название" value={room.name} onChange={(event) => updateRoom(room.id, { name: event.target.value })} fullWidth />
                  <TextField label="Площадь, м²" type="number" value={room.area} onChange={(event) => updateRoom(room.id, { area: event.target.value })} />
                  <TextField label="Периметр, м" type="number" value={room.perimeter} onChange={(event) => updateRoom(room.id, { perimeter: event.target.value })} />
                  <TextField label="Углы" type="number" value={room.corners} onChange={(event) => updateRoom(room.id, { corners: event.target.value })} />
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField label="Светильники" type="number" value={room.lightPoints} onChange={(event) => updateRoom(room.id, { lightPoints: event.target.value })} />
                  <TextField label="Трубы" type="number" value={room.pipes} onChange={(event) => updateRoom(room.id, { pipes: event.target.value })} />
                  <TextField label="Карниз, м" type="number" value={room.curtainTracks} onChange={(event) => updateRoom(room.id, { curtainTracks: event.target.value })} />
                  <TextField label="Ниши, м" type="number" value={room.niches} onChange={(event) => updateRoom(room.id, { niches: event.target.value })} />
                </Stack>

                <TextField
                  label="Заметка по комнате"
                  value={room.comment}
                  onChange={(event) => updateRoom(room.id, { comment: event.target.value })}
                  sx={{ mt: 2 }}
                  fullWidth
                />
              </Box>
            ))}
          </Stack>

          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography color="text.secondary">Позиции в смете</Typography>
            <Typography>{cartCount}</Typography>
          </Stack>
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography variant="h6">Итого</Typography>
            <Typography variant="h6" color="primary.main">{money(total)}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Отмена</Button>
        <Button variant="contained" onClick={() => onSave(draft)} disabled={saving || cartCount === 0}>
          {saving ? 'Сохраняю...' : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
