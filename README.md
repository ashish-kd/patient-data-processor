# Patient Data Processor

A Next.js 14 web application for processing and managing patient data. This application allows front-desk staff to upload CSV or Excel files containing patient information, view and edit the data in a table, and save changes to a MongoDB Atlas database.

## Features

- **File Upload**: Accepts CSV and Excel files with patient data
  - Supports `.csv` (via PapaParse) and `.xlsx` (via ExcelJS)
  - Uses chunked parsing for large files to prevent UI blocking
  - Processes files in the browser using web workers

- **Data Processing**:
  - Dynamically infers column fields
  - Accumulates all keys to build table headers
  - Handles arbitrary data structures

- **Data Storage**:
  - MongoDB Atlas backend
  - Flexible schema design

- **UI Features**:
  - Editable data table with sorting, filtering, and pagination
  - Tracks modified rows for saving
  - Toast notifications for actions and errors
  - Accessible design (keyboard navigation, ARIA labels)

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB Atlas account (or local MongoDB instance)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/patient-processor.git
   cd patient-processor
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory with the following environment variables:
   ```
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
   ```
   Replace the placeholders with your MongoDB Atlas connection information.

### Running the Application

#### Development

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

#### Production

```bash
npm run build
npm run start
```

### Testing

```bash
npm test
```

## Usage

1. **Upload File**:
   - Click "Select File" or drag and drop a CSV or Excel file
   - The application will parse the file and upload the data in chunks

2. **View Data**:
   - Browse the patients table
   - Use the search box to filter
   - Click column headers to sort
   - Use pagination controls to navigate

3. **Edit Data**:
   - Click on any cell to edit the value
   - Modified rows will be highlighted
   - Click "Save Changes" to update the database
   - Click "Revert All" to undo changes

## Project Structure

```
patient-processor/
├── components/           # React components
│   ├── FileUpload.tsx    # File upload component
│   └── PatientTable.tsx  # Patient data table component
├── lib/                  # Utility functions
│   ├── fileParser.ts     # File parsing utilities
│   └── mongodb.ts        # MongoDB connection utilities
├── models/               # Data models
│   └── Patient.ts        # Patient schema and helpers
├── pages/                # Next.js pages
│   ├── api/              # API routes
│   │   └── patients/     # Patient-related API endpoints
│   ├── _app.tsx          # Next.js app wrapper
│   └── index.tsx         # Main application page
├── public/               # Static assets
├── styles/               # CSS styles
│   └── globals.css       # Global styles
├── __tests__/            # Test files
├── .env.local            # Environment variables (create this file)
├── next.config.js        # Next.js configuration
├── package.json          # Dependencies and scripts
└── README.md             # Project documentation
```

## Troubleshooting

- **Database Connection Issues**: Ensure your MongoDB Atlas connection string is correct and your IP address is allowed in the Atlas network settings.
- **File Upload Errors**: Check that your file is properly formatted with a header row. The application expects the first row to contain column names.
- **Performance Issues**: For very large files, the application uses chunked parsing, but browser limitations may still apply. Consider splitting extremely large files.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request 