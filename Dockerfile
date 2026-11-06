FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY backend/pom.xml backend/pom.xml
COPY backend/src backend/src
WORKDIR /workspace/backend
RUN mvn -B package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /workspace/backend/target/campussync-backend-1.0.0.jar /app/app.jar
COPY dashboard /app/frontend/dashboard
COPY ["login_signup page", "/app/frontend/login_signup page"]
COPY onbording /app/frontend/onbording
ENV FRONTEND_ROOT=/app/frontend
CMD ["java", "-jar", "/app/app.jar"]
