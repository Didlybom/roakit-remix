import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary, Grid2 as Grid } from '@mui/material';
import type { ReactNode } from 'react';

export default function AccordionBox({
  title,
  children,
  expanded = true,
}: {
  title: string;
  children: ReactNode;
  expanded?: boolean;
}) {
  return (
    <Accordion
      variant="outlined"
      disableGutters
      defaultExpanded={expanded}
      sx={{ borderRadius: '6px', '& .MuiAccordionSummary-content': { fontSize: 'small' } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>{title}</AccordionSummary>
      <AccordionDetails sx={{ mb: 2, ml: '3px' }}>
        <Grid container spacing={5}>
          {children}
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
}
