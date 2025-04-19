<%@ page import="java.io.File" %>
<%@ page import="java.util.ArrayList" %>
<%@ page import="java.util.List" %>
<%
    // Get the directory path from request, default to root directory
    String currentDir = request.getParameter("dir");
    if (currentDir == null || currentDir.isEmpty()) {
        currentDir = "/";
    }

    File dir = new File(currentDir);
    List<File> files = new ArrayList<>();
    List<File> directories = new ArrayList<>();

    if (dir.isDirectory()) {
        File[] listFiles = dir.listFiles();
        if (listFiles != null) {
            for (File file : listFiles) {
                if (file.isDirectory()) {
                    directories.add(file);
                } else {
                    files.add(file);
                }
            }
        }
    } else {
        out.println("<h2>Invalid directory: " + currentDir + "</h2>");
        return;
    }
%>

<html>
<head>
    <title>Directory Explorer</title>
</head>
<body>
    <h1>Directory Explorer</h1>
    <h2>Current Directory: <%= currentDir %></h2>
    
    <!-- Parent Directory Link -->
    <% if (dir.getParent() != null) { %>
        <p><a href="directoryExplorer.jsp?dir=<%= dir.getParent() %>">.. (Parent Directory)</a></p>
    <% } %>

    <table border="1">
        <tr>
            <th>Type</th>
            <th>Name</th>
            <th>Actions</th>
        </tr>
        <!-- List Directories -->
        <% for (File directory : directories) { %>
            <tr>
                <td>Directory</td>
                <td><%= directory.getName() %></td>
                <td><a href="directoryExplorer.jsp?dir=<%= directory.getAbsolutePath() %>">Open</a></td>
            </tr>
        <% } %>

        <!-- List Files -->
        <% for (File file : files) { %>
            <tr>
                <td>File</td>
                <td><%= file.getName() %></td>
                <td><a href="<%= file.getAbsolutePath() %>">Download/View</a></td>
            </tr>
        <% } %>
    </table>
</body>
</html>
