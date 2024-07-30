// see https://codepen.io/peeke/pen/BjxXZa

import { keyframes, styled } from '@mui/material';

const pulseRing = keyframes`
  0% {
    transform: scale(.33);
  }
  80%, 100% {
    opacity: 0;
  }
}
`;

const pulseDot = keyframes`
  0% {
    transform: scale(.8);
  }
  50% {
    transform: scale(1);
  }
  100% {
    transform: scale(.8);
  }
};
`;

const Pulse = styled('div')(({ theme }) => ({
  width: '5px',
  height: '5px',

  '&:before': {
    content: "''",
    position: 'relative',
    display: 'block',
    width: '400%',
    height: '400%',
    boxSizing: 'border-box',
    marginLeft: '-100%',
    marginTop: '-100%',
    borderRadius: '45px',
    backgroundColor: theme.palette.grey[300],
    animation: `${pulseRing} 3s cubic-bezier(0.215, 0.61, 0.355, 1) infinite`,
  },

  '&:after.': {
    content: "''",
    position: 'absolute',
    left: 0,
    top: 0,
    display: 'block',
    width: '100%',
    height: '100%',
    backgroundColor: theme.palette.common.white,
    borderRadius: '15px',
    boxShadow: '0 0 8px rgba(0,0,0,.3)',
    animation: `${pulseDot} 3s cubic-bezier(0.455, 0.03, 0.515, 0.955) -.4s infinite`,
  },
}));

export default Pulse;
