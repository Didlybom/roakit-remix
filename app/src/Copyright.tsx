import Typography from '@mui/material/Typography';

export default function Copyright() {
  return (
    <>
      <Typography variant="h6" align="center" sx={{ mt: 5 }}>
        Under construction
      </Typography>
      <Typography variant="body2" color="text.secondary" align="center" sx={{ m: 3 }}>
        {'Copyright © ROAKIT'} {new Date().getFullYear()}.
      </Typography>
    </>
  );
}
