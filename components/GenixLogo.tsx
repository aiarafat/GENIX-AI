import React from 'react';

interface GenixLogoProps {
  className?: string;
  src?: string;
}

export const GenixLogo: React.FC<GenixLogoProps> = ({ 
  className = "w-6 h-6",
  // Default placeholder logo. You can replace this default or pass a 'src' prop when using the component.
  src = "https://cdn-icons-png.flaticon.com/512/12222/12222588.png"
}) => (
  <img 
    src={src} 
    alt="Genix AI" 
    className={`${className} object-contain`} 
  />
);