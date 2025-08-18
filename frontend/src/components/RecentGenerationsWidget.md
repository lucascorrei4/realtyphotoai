# RecentGenerationsWidget

A reusable React component that displays past AI generations with before/after image comparisons, filtering, and pagination. This widget can be integrated into any service page to show user generation history.

## Features

- **Before/After Image Comparison**: Side-by-side display of input and output images
- **Advanced Filtering**: Filter by model type, status, and date range
- **Pagination**: Navigate through large numbers of generations
- **Responsive Design**: Works on all screen sizes
- **Dark Mode Support**: Automatically adapts to theme
- **Loading States**: Smooth loading animations
- **Error Handling**: Graceful error display
- **Customizable**: Configurable title, description, and styling

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `userId` | `string` | - | User ID to fetch generations for |
| `title` | `string` | "Recent Generations" | Widget title |
| `description` | `string` | "View your past AI generations..." | Widget description |
| `showFilters` | `boolean` | `true` | Whether to show filter controls |
| `maxItems` | `number` | `10` | Maximum items per page |
| `className` | `string` | `""` | Additional CSS classes |

## Usage

### Basic Usage

```tsx
import { RecentGenerationsWidget } from '../components';

<RecentGenerationsWidget userId="user123" />
```

### With Custom Configuration

```tsx
<RecentGenerationsWidget
  userId="user123"
  title="My Interior Designs"
  description="View your latest room transformations"
  showFilters={true}
  maxItems={20}
  className="custom-styling"
/>
```

### In Service Pages

```tsx
// Interior Design Page
<RecentGenerationsWidget
  userId={user?.id}
  title="Interior Design History"
  description="Your latest room transformations"
  showFilters={true}
  maxItems={10}
/>

// Image Enhancement Page
<RecentGenerationsWidget
  userId={user?.id}
  title="Enhanced Images"
  description="Your image enhancement history"
  showFilters={true}
  maxItems={15}
/>
```

## API Integration

The widget automatically integrates with the backend API endpoints:

- **GET** `/api/v1/user/generations` - Fetches generations with pagination and filtering
- Supports query parameters: `page`, `limit`, `modelType`, `status`, `dateFrom`, `dateTo`

### Backend Requirements

The backend must provide a response in this format:

```json
{
  "success": true,
  "data": {
    "generations": [...],
    "totalCount": 100,
    "totalPages": 10,
    "currentPage": 1,
    "itemsPerPage": 10
  }
}
```

## Filtering Options

### Model Type
- `interior_design` - Interior design transformations
- `image_enhancement` - Image enhancement processing
- `element_replacement` - Element replacement operations
- `all` - Show all types

### Status
- `completed` - Successfully processed
- `processing` - Currently being processed
- `failed` - Processing failed
- `pending` - Waiting to be processed
- `all` - Show all statuses

### Date Range
- `dateFrom` - Start date (inclusive)
- `dateTo` - End date (inclusive)

## Styling

The widget uses Tailwind CSS classes and supports custom styling through the `className` prop. It automatically adapts to light/dark themes.

### Custom Styling Examples

```tsx
// Custom border
<RecentGenerationsWidget
  userId="user123"
  className="border-2 border-blue-200 dark:border-blue-800"
/>

// Custom background
<RecentGenerationsWidget
  userId="user123"
  className="bg-gradient-to-r from-purple-50 to-blue-50"
/>

// Custom spacing
<RecentGenerationsWidget
  userId="user123"
  className="mt-8 mb-4"
/>
```

## Responsive Behavior

- **Mobile**: Single column layout, stacked filters
- **Tablet**: Two-column layout, side-by-side filters
- **Desktop**: Full layout with all features visible

## Performance Considerations

- Images are loaded lazily
- Pagination prevents loading too many items at once
- Debounced filter changes reduce API calls
- Efficient re-rendering with React hooks

## Error Handling

The widget gracefully handles various error scenarios:

- **Network Errors**: Shows user-friendly error messages
- **Empty Results**: Displays appropriate empty state
- **Invalid User ID**: Shows placeholder content
- **API Failures**: Retry functionality with refresh button

## Accessibility

- Semantic HTML structure
- ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader friendly
- High contrast support

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Dependencies

- React 16.8+
- Lucide React (for icons)
- Tailwind CSS (for styling)

## Examples

See the `WidgetDemo.tsx` page for comprehensive examples of different widget configurations and use cases.

## Integration Checklist

- [ ] Backend API endpoint implemented (`/api/v1/user/generations`)
- [ ] Database schema includes required fields
- [ ] User authentication system in place
- [ ] Image storage configured
- [ ] Frontend routing set up
- [ ] Component imported and styled
- [ ] User ID passed to widget
- [ ] Error handling tested
- [ ] Responsive design verified
- [ ] Performance tested with large datasets

## Troubleshooting

### Common Issues

1. **Widget not loading**: Check if `userId` is provided and valid
2. **Images not displaying**: Verify image URLs are accessible
3. **Filters not working**: Ensure backend supports filter parameters
4. **Pagination issues**: Check backend pagination implementation
5. **Styling conflicts**: Verify Tailwind CSS is properly configured

### Debug Mode

Enable console logging by setting the environment variable:
```bash
REACT_APP_DEBUG=true
```

## Contributing

When modifying the widget:

1. Maintain backward compatibility
2. Add TypeScript types for new props
3. Update documentation
4. Test with different configurations
5. Verify responsive behavior
6. Check accessibility compliance

## License

This component is part of the RealtyPhotoAI project and follows the same licensing terms.
