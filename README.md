# Image Annotation System

A modern React + Next.js web application for creating bounding box annotations on images, designed for machine learning training data preparation.

## Features

- 🖼️ **Image Loading**: Load images from URLs or local files
- 📦 **Bounding Box Creation**: Draw precise bounding boxes with drag and resize
- 💾 **Auto-Save**: Automatic saving to localStorage on submission
- 📤 **Batch Export**: Export all annotations as JSON for ML training
- 🎯 **Pixel-Perfect**: Accurate coordinate mapping for training data
- 📱 **Responsive**: Works on desktop and mobile devices

## Live Demo

Visit the live application: [https://yourusername.github.io/image-annotation-system](https://yourusername.github.io/image-annotation-system)

## Quick Start

### Development

```bash
# Clone the repository
git clone https://github.com/yourusername/image-annotation-system.git
cd image-annotation-system

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

### Deploy to GitHub Pages

```bash
# Build and deploy to gh-pages branch
npm run deploy
```

## Usage

1. **Load Image**: Enter an image URL or upload a local file
2. **Create Annotations**: Click and drag to create bounding boxes
3. **Adjust Boxes**: Drag to move, resize handles to adjust size
4. **Submit**: Click "Submit Annotation" to save to localStorage
5. **Export**: Use "Export All Data" to download JSON with all annotations

## Data Format

Exported JSON structure:
```json
{
  "export_info": {
    "export_date": "2025-10-19T20:23:00Z",
    "total_images": 2,
    "total_annotations": 5
  },
  "annotation_records": [
    {
      "session_id": "session_1634567890123",
      "image_url": "https://example.com/image.jpg",
      "original_size": {"width": 1920, "height": 1080},
      "display_size": {"width": 960, "height": 540},
      "scale_factor": 0.5,
      "timestamp": "2025-10-19T20:23:00Z",
      "bounding_boxes": [
        {
          "id": "box_1634567890123_abc123",
          "x": 100,
          "y": 150,
          "width": 200,
          "height": 250,
          "label": "anime_face"
        }
      ]
    }
  ]
}
```

## Technology Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Storage**: Browser localStorage
- **Deployment**: GitHub Pages
- **CI/CD**: GitHub Actions

## Project Structure

```
src/
├── app/                 # Next.js app router
├── components/          # React components
│   ├── ImageAnnotation/ # Main annotation components
│   └── ui/             # Reusable UI components
├── hooks/              # Custom React hooks
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/yourusername/image-annotation-system/issues).
