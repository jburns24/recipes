# Use the official Nginx image
FROM nginx:alpine

# Remove the default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy the contents of src/ into the nginx html directory
COPY src/ /usr/share/nginx/html/

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
