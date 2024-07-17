import { Clear as ClearIcon, Search as SearchIcon } from '@mui/icons-material';
import { IconButton, InputAdornment, TextField, type SxProps } from '@mui/material';

export default function SearchField({
  title,
  value,
  setValue,
  sx,
}: {
  title: string;
  value: string;
  setValue: (value: string) => void;
  sx?: SxProps;
}) {
  return (
    <TextField
      autoComplete="off"
      value={value}
      placeholder="Search"
      title={title}
      size="small"
      sx={sx}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start" sx={{ display: { xs: 'none', sm: 'flex' } }}>
            <SearchIcon />
          </InputAdornment>
        ),
        ...(value && {
          endAdornment: (
            <InputAdornment position="end" sx={{ display: { xs: 'none', sm: 'flex' } }}>
              <IconButton edge="end" onClick={() => setValue('')}>
                <ClearIcon />
              </IconButton>
            </InputAdornment>
          ),
        }),
      }}
      onChange={e => setValue(e.target.value)}
      onKeyDown={e => (e.key === 'Escape' ? setValue('') : null)}
    />
  );
}
