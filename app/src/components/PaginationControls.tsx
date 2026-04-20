import { Pagination, Stack } from '@mui/material';

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  nextPageDisabled?: boolean;
  onPageChange: (page: number) => void;
}

export default function PaginationControls({
  page,
  totalPages,
  onPageChange,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  return (
    <Stack direction="row" sx={{ mt: 3, justifyContent: 'center' }}>
      <Pagination
        count={totalPages}
        page={page}
        onChange={(_, newPage) => onPageChange(newPage)}
        showFirstButton
        showLastButton
        color="primary"
        shape="rounded"
        size="large"
      />
    </Stack>
  );
}
