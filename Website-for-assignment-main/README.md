# EduSubmit — Assignment Portal

A beautiful, full-stack assignment submission portal deployable to Netlify in minutes.

## Features

- 🎨 Modern dark-themed UI for students
- 📋 Admin panel to create/manage assignments
- 📤 File upload (PDF, DOC, DOCX up to 20MB)
- 📥 Download individual files or all submissions as a ZIP
- 🔒 Admin authentication with session tokens
- ☁️ Serverless backend via Netlify Functions
- 💾 File storage via Netlify Blobs (no external DB needed)

---

## Deployment Steps

### 1. Prerequisites
- A [Netlify account](https://netlify.com) (free tier works)
- Git installed (or use Netlify's drag-and-drop deploy)

### 2. Deploy via Netlify CLI (Recommended)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Install dependencies
npm install

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod
```

### 3. Deploy via Drag & Drop
1. Go to [netlify.com](https://netlify.com) → "Add new site" → "Deploy manually"
2. Zip this entire folder and drag it to the deploy area
3. **Important**: Also set up the functions by connecting to a Git repo (see step 4)

### 4. Deploy via GitHub (Best for production)
1. Push this folder to a GitHub repository
2. In Netlify: "Add new site" → "Import an existing project" → Connect GitHub
3. Set build settings:
   - Build command: (leave empty)
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
4. Click Deploy

### 5. Set Environment Variables (IMPORTANT!)

In Netlify Dashboard → Site Settings → Environment Variables, add:

| Variable | Value | Description |
|---|---|---|
| `ADMIN_USERNAME` | `admin` | Your admin login username |
| `ADMIN_PASSWORD` | `YourSecurePassword123!` | Your admin login password |
| `TOKEN_SECRET` | `some-random-secret-string-here` | JWT signing secret |

⚠️ **Change the default password before going live!**

### 6. Enable Netlify Blobs
Netlify Blobs is automatically available on all Netlify sites. No extra setup needed.

---

## Usage

### For Students
1. Visit your site URL (e.g., `https://your-site.netlify.app`)
2. Browse open assignments
3. Click "Submit" on an assignment
4. Fill in name, student ID, upload file, and submit

### For Admin
1. Visit `https://your-site.netlify.app/admin`
2. Login with your admin credentials
3. **Dashboard**: See overview stats and recent submissions
4. **Assignments**: Create new assignments (subject, description, due date)
5. **Submissions**: View all submissions, download individual files, or use "Download All" to get a ZIP of everything organized by subject

---

## File Structure

```
assignment-portal/
├── netlify.toml              # Netlify configuration
├── package.json              # Dependencies
├── public/                   # Static frontend
│   ├── index.html            # Student portal
│   └── admin/
│       └── index.html        # Admin dashboard
└── netlify/
    └── functions/            # Serverless API
        ├── _auth.js          # Auth helper
        ├── admin-auth.js     # Login endpoint
        ├── get-assignments.js # List assignments (public)
        ├── create-assignment.js # Create assignment (admin)
        ├── delete-assignment.js # Delete assignment (admin)
        ├── submit-assignment.js # File upload endpoint (student)
        ├── get-submissions.js   # List submissions (admin)
        ├── download-file.js     # Download one file (admin)
        ├── download-all.js      # Download all as ZIP (admin)
        └── delete-submission.js # Delete submission (admin)
```

---

## Security Notes

- Admin panel is protected by username/password authentication
- Session tokens expire after 24 hours
- File type validation (PDF, DOC, DOCX only)
- File size limit: 20MB per upload
- All admin API endpoints require valid auth token

---

## Customization

- **Change admin credentials**: Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` env vars
- **Change site name**: Search and replace "EduSubmit" in HTML files
- **Adjust file size limit**: Edit `limits.fileSize` in `submit-assignment.js`
- **Add more file types**: Update the extension check in `submit-assignment.js`
