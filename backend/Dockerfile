FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY .mvn .mvn
COPY mvnw .
RUN chmod +x mvnw
RUN mvn dependency:go-offline -B
COPY src src
RUN mvn -DskipTests package -B

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=build /app/target/fieldservice-1.0.0.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
