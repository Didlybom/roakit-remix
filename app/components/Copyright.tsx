import EngineeringIcon from '@mui/icons-material/Engineering';
import { Box, Button, Stack } from '@mui/material';
import Typography from '@mui/material/Typography';

export default function Copyright() {
  return (
    <Box display="flex" justifyContent="center" sx={{ mt: 3 }}>
      <Stack>
        <Button disabled size="small" startIcon={<EngineeringIcon />}>
          under construction
        </Button>
        <Typography align="center" variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {'Copyright © ROAKIT'} {new Date().getFullYear()}
        </Typography>
      </Stack>
    </Box>
  );
}
