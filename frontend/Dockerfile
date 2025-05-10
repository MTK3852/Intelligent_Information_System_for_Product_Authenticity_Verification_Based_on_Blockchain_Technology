FROM nginx:latest

#Deleting default configs of NGINX
RUN rm -rf /etc/nginx/nginx.conf

#Adding NGINX conf and website
RUN mkdir /etc/nginx/sites-available
RUN mkdir /etc/nginx/sites-available/frontend
COPY ./ /etc/nginx/sites-available/frontend/

COPY nginx.conf /etc/nginx/nginx.conf


