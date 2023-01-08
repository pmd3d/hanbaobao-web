# HanBaoBao - Orleans sample application

This is an [Orleans](https://github.com/dotnet/orleans) sample application which demonstrates a small, but relatively realistic application and deployment to Kubernetes.

![](./assets/demo-1.png)

The application is a bilingual dictionary supporting English and Mandarin Chinese. The dictionary is a single-page Web app, built with [VueJS](https://vuejs.org/) and [Bootstrap](https://getbootstrap.com/).

The application uses the [.NET Generic Host](https://docs.microsoft.com/en-us/dotnet/core/extensions/generic-host) to co-host ASP.NET Core and Orleans together in the same process. It could be extended to add ASP.NET SignalR and/or gRPC, or any other service which supports the generic host.

The Web app sends HTTP requests which are handled by ASP.NET Core MVC controllers which call into various Orleans grains. The grains in this project are:

* `DictionaryEntryGrain`, with one instance per dictionary entry. The grain is keyed on the dictionary headword, such as "你好" (*nǐ hǎo*, which means *hello*). `DictionaryEntryGrain` demonstrates Orleans' optional persistence model.
* `SearchGrain`, with one instance per unique search query. The grain is keyed on the search query itself, such as "hello". `SearchGrain` fans out to `DictionaryEntryGrain` instances and collects the results. It then caches the results for a short period of time to demonstrate the simplicity of this pattern.
* `UserAgentGrain`, with one instance per client, keyed on the client's IP address. `UserAgentGrain` is responsible for proxying all user searches and throttling users who make too many calls in a short period of time. It is intentionally very aggressive with throttling (4 requests in 5 seconds is enough to trigger throttling). It demonstrates this *user agent* pattern, where each user is assigned a grain which makes calls on their behalf. It also demonstrates how simple throttling or other request tracking can be implemented using an `IIncomingGrainCallFilter` implementation.

The application can be run locally from the *HanBaoBaoWeb* folder by executing:

``` PowerShell
dotnet run -c Release
```

After doing so, open a browser to http://localhost:5000 to play with the app.

npm install -g @angular/cli
ng new my-app
cd my-app
ng serve --open
ng serve --open --disable-host-check
ng build --watch in my-app folder...

The app can also be deployed to Kubernetes. The important file is `deployment.yaml`, which describes the required Kubernetes resources. Before deploying the app, you will need to provision the following resources:
The more current way of this is to update the outDir property in angular.json(called .angular-cli.json in old Angular CLI versions).

* A resource group
* An Azure Container Registry (ACR) container registry
* An Azure Kubernetes Service (AKS) cluster
* A Service Principal which allows AKS to access ACR

The [`provision.ps1`](./provision.ps1) script attempts to automate these steps, with some required names defined at the top of the script:

``` PowerShell
# Choose some resource names. Note that some of these are globally unique across all of Azure, so you will need to change them
$resourceGroup = "hanbaobao"
$location = "westus"
$clusterName = "hanbaobao"
$containerRegistry = "hanbaobaoacr"

az login

# Create a resource group
az group create --name $resourceGroup --location $location

# Create an AKS cluster. This can take a few minutes
az aks create --resource-group $resourceGroup --name $clusterName --node-count 3

# If you haven't already, install the Kubernetes CLI
az aks install-cli

# Authenticate the Kubernetes CLI
az aks get-credentials --resource-group $resourceGroup --name $clusterName

# Create an Azure Container Registry account and login to it
az acr create --name $containerRegistry --resource-group $resourceGroup --sku Standard

# Create a service principal for the container registry and register it with Kubernetes as an image pulling secret
$acrId = $(az acr show --name $containerRegistry --query id --output tsv)
$acrServicePrincipalName = "$($containerRegistry)-aks-service-principal"
$acrSpPw = $(az ad sp create-for-rbac --name http://$acrServicePrincipalName --scopes $acrId --role acrpull --query password --output tsv)
$acrSpAppId = $(az ad sp show --id http://$acrServicePrincipalName --query appId --output tsv)
$acrLoginServer = $(az acr show --name $containerRegistry --resource-group $resourceGroup --query loginServer).Trim('"')
kubectl create secret docker-registry $containerRegistry --namespace default --docker-server=$acrLoginServer --docker-username=$acrSpAppId --docker-password=$acrSpPw
```

With those resources provisioned, we can define our application and deploy it. Create a file called `deployment.yaml` with the following contents, making changes where necessary depending on the resource names you chose when provisioning the resources. Look for the `# REPLACEME` comments and replace those values. We will explain the structure of the file below.

``` yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: mcr.microsoft.com/oss/bitnami/redis:6.0.8
        env:
        - name: ALLOW_EMPTY_PASSWORD
          value: "yes"
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 250m
            memory: 256Mi
        ports:
        - containerPort: 6379
          name: redis
---
apiVersion: v1
kind: Service
metadata:
  name: redis
spec:
  ports:
  - port: 6379
  selector:
    app: redis
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hanbaobao
  labels:
    app: hanbaobao
spec:
  selector:
    matchLabels:
      app: hanbaobao
  replicas: 3
  template:
    metadata:
      labels:
        app: hanbaobao

        # The serviceId label is used to identify the service to Orleans
        orleans/serviceId: hanbaobao

        # The clusterId label is used to identify an instance of a cluster to Orleans.
        # Typically, this will be the same value as serviceId or any fixed value.
        # In cases where you are not using rolling deployments (for example, blue/green deployments),
        # this value can allow for distinct clusters which do not communicate directly with each others,
        # but which still share the same storage and other resources.
        orleans/clusterId: hanbaobao
    spec:
      containers:
        - name: main
          image: hanbaobaoacr.azurecr.io/hanbaobao # REPLACEME
          imagePullPolicy: Always
          ports:
          # Define the ports which Orleans uses
          - containerPort: 11111
          - containerPort: 30000
          # Define the ASP.NET Core ports
          - containerPort: 80
          - containerPort: 443
          env:
          # Configure settings to let Orleans know which cluster it belongs to and which pod it 
          # is running in. These five values are needed by the
          # Microsoft.Orleans.Hosting.Kubernetes package
          - name: ORLEANS_SERVICE_ID
            valueFrom:
              fieldRef:
                fieldPath: metadata.labels['orleans/serviceId']
          - name: ORLEANS_CLUSTER_ID
            valueFrom:
              fieldRef:
                fieldPath: metadata.labels['orleans/clusterId']
          - name: POD_NAMESPACE
            valueFrom:
              fieldRef:
                fieldPath: metadata.namespace
          - name: POD_NAME
            valueFrom:
              fieldRef:
                fieldPath: metadata.name
          - name: POD_IP
            valueFrom:
              fieldRef:
                fieldPath: status.podIP
          - name: DOTNET_SHUTDOWNTIMEOUTSECONDS
            value: "120"
          - name: REDIS
            value: "redis" # The name of the redis service defined above
      terminationGracePeriodSeconds: 180
      imagePullSecrets:
        - name: hanbaobaoacr # REPLACEME
  minReadySeconds: 60
  strategy:
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
---
# In order to be able to access the service from outside the cluster, we will need to add a Service object
apiVersion: v1
kind: Service
metadata:
  name: hanbaobao
spec:
  type: LoadBalancer
  ports:
  - port: 80
  selector:
    app: hanbaobao

# For RBAC-enabled clusters, the Kubernetes service account for the pods may also need to be granted the required access:
---
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: pod-reader
rules:
- apiGroups: [ "" ]
  resources: ["pods"]
  verbs: ["get", "watch", "list"]
---
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: pod-reader-binding
subjects:
- kind: ServiceAccount
  name: default
  apiGroup: ''
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: ''
```

The file is large and could be intimidating at first, but the basic structure is to create two *Deployment* resources: one for Redis and one for our application. Each Deployment has a corresponding *Service* which is used for routing traffic. In addition, because this sample uses the `Microsoft.Orleans.Kubernetes.Hosting` package, which queries the Kubernetes API, you will need to provision a *Role* and corresponding *RoleBinding* if your cluster is RBAC enabled. The `deployment.yaml` file contains one section for each of those resources, separated by `---`.

With the `deployment.yaml` file created, now we need to build and deploy the application. The build process is multi-stage:

* Use `npm` to build the Web app and copy it into the `HanBaoBaoWeb/wwwroot` folder of the main application
* Use `docker` to copy the source into a new build container and build the application, then copy the result into a fresh layer

The prerequisites for this are *NPM* and *Docker*. With those installed, open a terminal to the `site` directory and execute:

``` PowerShell
npm install
npm run build
```

With the Web app published into the `HanBaoBaoWeb/wwwroot` directory, move back to the root directory of the repository, then execute the following to build the container image and push it to ACR.
Note that you will need to substitute the variable names as you did when provisioning the resources.

``` PowerShell
$resourceGroup = "hanbaobao"
$containerRegistry = "hanbaobaoacr"

$acrLoginServer = $(az acr show --name $containerRegistry --resource-group $resourceGroup --query loginServer).Trim('"')
az acr login --name $containerRegistry

docker build . -t $acrLoginServer/hanbaobao &&
docker push $acrLoginServer/hanbaobao &&
kubectl apply -f ./deployment.yaml &&
kubectl rollout restart deployment/hanbaobao
```

The last command executed restarts the deployment. That is only necessary if you use the above script to publish an *updated* image. Similarly, re-applying the `deployment.yaml` file is not necessary if it is unchanged.

If all of the previous steps succeeded, then we can watch the changes in the active pods:

``` PowerShell
kubectl get pods --watch
```

If no errors were encountered, then the pods should all enter the *Running* state, at which point we can find out what IP address was provisioned for our service by querying the `hanbaobao` service object which we created:

``` PowerShell 
kubectl get service hanbaobao
```

The `EXTERNAL-IP` value in the output is how we can access the service using a Web browser.
