import { SvgIcon, type SvgIconProps } from '@mui/material';
import { forwardRef } from 'react';

const Jira = forwardRef<SVGSVGElement, SvgIconProps>((props, ref) => (
  <SvgIcon {...props} ref={ref}>
    <svg xmlns="http://www.w3.org/2000/svg" width="1.3em" height="1.3em" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 0 0-.84-.84zM6.77 6.8a4.36 4.36 0 0 0 4.34 4.34h1.8v1.72a4.36 4.36 0 0 0 4.34 4.34V7.63a.84.84 0 0 0-.83-.83zM2 11.6c0 2.4 1.95 4.34 4.35 4.34h1.78v1.72c.01 2.39 1.95 4.34 4.34 4.34v-9.57a.84.84 0 0 0-.84-.84z"
      />
    </svg>
  </SvgIcon>
));
Jira.displayName = 'Jira';

export default Jira;
