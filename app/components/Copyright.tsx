import { Unstable_Grid2 as Grid, Typography } from '@mui/material';
import { grey, indigo } from '@mui/material/colors';
import theme from '../utils/theme';

export default function Copyright() {
  return (
    <Grid
      container
      sx={{
        px: 2,
        py: 1,
        textWrap: 'nowrap',
        zIndex: theme.zIndex.drawer + 1,
        backgroundColor: indigo[50],
        borderTop: 'solid 1px',
        borderColor: grey[200],
      }}
    >
      <Grid>
        <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
          {'Copyright © ROAKIT'} {new Date().getFullYear()}.
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
