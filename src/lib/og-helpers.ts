type Weight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
type FontStyle = 'normal' | 'italic';

type FontOptions = {
  name: string;
  data: ArrayBuffer;
  style: FontStyle;
  weight: Weight;
};

export async function loadSpaceGroteskFont(): Promise<FontOptions> {
  // Load the Space Grotesk font
  const spaceGroteskFont = await fetch(
    new URL('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap'),
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1'
      }
    }
  ).then((res) => res.text());

  const match = spaceGroteskFont.match(/src:\s*url\((?:'|")?([^'")]+)(?:'|")?\)\s*format\((?:'|")?(opentype|truetype)(?:'|")?\)/);
  if (!match) {
    console.error('Failed to parse Google Fonts CSS:', spaceGroteskFont);
    throw new Error('Failed to parse Google Fonts CSS');
  }
  const fontUrl = match[1];
  const fontData = await fetch(fontUrl).then((res) => res.arrayBuffer());

  return {
    name: 'Space Grotesk',
    data: fontData,
    style: 'normal',
    weight: 700,
  };
} 