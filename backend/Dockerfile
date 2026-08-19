FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY backend/pom.xml backend/pom.xml
COPY backend/.mvn backend/.mvn
COPY backend/mvnw backend/mvnw
WORKDIR /app/backend
RUN mvn dependency:go-offline -B
COPY backend/src src
RUN mvn -DskipTests package -B

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=build /app/backend/target/fieldservice-1.0.0.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
