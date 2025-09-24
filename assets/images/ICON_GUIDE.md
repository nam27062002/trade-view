# PWA Icons Guide

## Required Icons for Trading Dashboard PWA

You need to create the following icon files with the exact names and sizes:

### Standard Favicon Icons:
- `icon-16x16.png` - 16x16 pixels (browser tab)
- `icon-32x32.png` - 32x32 pixels (browser tab)

### PWA Icons (all square, transparent background recommended):
- `icon-72x72.png` - 72x72 pixels
- `icon-96x96.png` - 96x96 pixels
- `icon-128x128.png` - 128x128 pixels
- `icon-144x144.png` - 144x144 pixels
- `icon-152x152.png` - 152x152 pixels
- `icon-180x180.png` - 180x180 pixels (Apple touch icon)
- `icon-192x192.png` - 192x192 pixels (Android home screen)
- `icon-384x384.png` - 384x384 pixels
- `icon-512x512.png` - 512x512 pixels (splash screen)

### Microsoft Tile Icons:
- `icon-310x150.png` - 310x150 pixels (wide tile)
- `icon-310x310.png` - 310x310 pixels (large square tile)

### Optional Screenshots (for app store):
- `screenshot-mobile.png` - 390x844 pixels (mobile view)
- `screenshot-desktop.png` - 1920x1080 pixels (desktop view)

## Design Recommendations:

### Icon Design:
- **Theme**: Dark background (#0d1117) with blue accent (#58a6ff)
- **Symbol**: Use 📊 chart emoji or create a simple chart icon
- **Style**: Modern, minimalist, flat design
- **Colors**: Match the app theme colors
- **Format**: PNG with transparent background for best results

### Design Ideas:
1. **Chart Symbol**: Simple bar chart or line graph icon
2. **Letter "T"**: Stylized "T" for "Trading"
3. **Dashboard Icon**: Grid pattern representing dashboard layout
4. **Combined**: Chart + dollar sign or currency symbol

## How to Create:

### Option 1: Online Tools (Recommended)
- Use **PWA Builder Icon Generator**: https://www.pwabuilder.com/imageGenerator
- Use **Favicon.io**: https://favicon.io/favicon-generator/
- Upload one 512x512 master icon and generate all sizes

### Option 2: Design Software
- Create 512x512 master icon in Figma/Photoshop/GIMP
- Export to all required sizes
- Ensure each size looks crisp and readable

### Option 3: Simple Text-based
```
Background: #0d1117 (dark)
Text: "📊" or "TD"
Font: Bold, white (#ffffff) or blue (#58a6ff)
```

## Quick Start:
1. Create a 512x512 PNG icon with dark theme
2. Use online tool to generate all sizes automatically
3. Place all files in this `/assets/images/` directory
4. Test PWA installation on mobile device

## Testing:
- Test on Chrome Android (install prompt should appear)
- Test on Safari iOS (add to home screen via share menu)
- Verify icons appear correctly in all contexts

---
**Note**: Without proper icons, the PWA may still work but won't have professional appearance when installed on mobile devices.