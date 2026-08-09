import React from 'react';

// MindMapLoader Component: Displays an animated mind-map structure as a loading indicator.
const MindMapLoader = () => {
  // --- Configuration ---
  const width = 150; // SVG canvas width
  const height = 150; // SVG canvas height
  const centerX = width / 2;
  const centerY = height / 2;
  const mainRadius = 10; // Radius of the central node
  const childRadius = 7; // Radius of the child nodes
  const branchLength = 45; // Length of the connecting lines
  const numBranches = 5; // Number of branches extending from the center
  const animationDuration = 1.8; // Base duration for pulse animations (in seconds)
  const drawSpeed = 0.6; // Duration for line drawing animation (in seconds)
  const appearSpeed = 0.5; // Duration for node appearance animation (in seconds)
  const staggerDelay = 0.15; // Delay between each branch animation starts (in seconds)

  // --- Calculations ---
  const branches = Array.from({ length: numBranches }).map((_, i) => {
    const angle = (i * 2 * Math.PI) / numBranches - Math.PI / 2;
    const x2 = centerX + branchLength * Math.cos(angle);
    const y2 = centerY + branchLength * Math.sin(angle);
    const lineLength = Math.sqrt(Math.pow(x2 - centerX, 2) + Math.pow(y2 - centerY, 2));
    return { x2, y2, lineLength, index: i };
  });

  // --- Render ---
  return (
    <div className="flex justify-center items-center w-full py-10">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label="Loading mind map">
        {/* Central Node */}
        <circle
          cx={centerX}
          cy={centerY}
          r={mainRadius}
          fill="none"
          stroke="#3d3d3a"
          strokeWidth="2.5"
          className="node center-node"
        />

        {/* Branches */}
        {branches.map((branch) => (
          <g key={branch.index}>
            {/* Line */}
            <line
              x1={centerX}
              y1={centerY}
              x2={branch.x2}
              y2={branch.y2}
              stroke="#a8a294"
              strokeWidth="2"
              className="line"
              style={{
                '--line-length': branch.lineLength,
                animationDelay: `${staggerDelay * branch.index}s`,
              } as React.CSSProperties}
            />
            {/* Child Node */}
            <circle
              cx={branch.x2}
              cy={branch.y2}
              r={childRadius}
              fill="#a8a294"
              stroke="#3d3d3a"
              strokeWidth="1"
              className="node child-node"
              style={{
                animationDelay: `${staggerDelay * branch.index + drawSpeed * 0.75}s, ${staggerDelay * branch.index + drawSpeed + appearSpeed}s`
              } as React.CSSProperties}
            />
          </g>
        ))}
      </svg>

      {/* Animation Styles */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); stroke-opacity: 0.7; }
          50% { transform: scale(1.15); stroke-opacity: 1; }
        }
        @keyframes draw {
          from { stroke-dashoffset: var(--line-length); }
          to { stroke-dashoffset: 0; }
        }
        @keyframes appear {
          from { opacity: 0; transform: scale(0.3); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes continuous-pulse-child {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 1; }
        }
        .node { transform-origin: center center; }
        .center-node { animation: pulse ${animationDuration}s infinite ease-in-out; }
        .line {
          stroke-dasharray: var(--line-length);
          stroke-dashoffset: var(--line-length);
          animation: draw ${drawSpeed}s ease-out forwards;
        }
        .child-node {
          opacity: 0;
          animation:
            appear ${appearSpeed}s ease-out forwards,
            continuous-pulse-child ${animationDuration}s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default MindMapLoader;
