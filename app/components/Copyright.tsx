import { Unstable_Grid2 as Grid, Typography } from '@mui/material';
import { grey, indigo } from '@mui/material/colors';

export default function Copyright() {
  return (
    <Grid
      container
      sx={{
        px: 2,
        py: 1,
        textWrap: 'nowrap',
        backgroundColor: indigo[50],
        borderTop: 'solid 1px',
        borderColor: grey[200],
      }}
    >
      <Grid>
        <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
          {'Copyright © Roakit'} {new Date().getFullYear()}.
        </Typography>
      </Grid>
      <Grid>
        <Typography variant="body2" color="text.disabled" sx={{ pl: 1 }}>
          Work in progress. Please pardon our dust.
        </Typography>
      </Grid>
    </Grid>
  );
}
