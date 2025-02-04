import Paw from "../../types-paw-api/paw"
import OpenAPI, {MapKeyedWithString} from "../../types-paw-api/openapi"
import URL from "../url"
import ParametersConverter from "./components/parameters-converter";
import AuthConverter, {AuthConverterType} from "./components/auth-converter";
import ResponsesConverter from "./components/responses-converter";


export default class PawToOpenapiConverter {
    private info: OpenAPI.InfoObject
    private paths: OpenAPI.PathsObject
    private components: OpenAPI.ComponentsObject
    private servers_change: Map<string, string[]>
    private servers: OpenAPI.ServerObject[]

    constructor() {
        this.info = {
            title: "OpenAPI export",
            version: Date.now().toString()
        }
        this.paths = {}
        this.components = {
            securitySchemes: {},
            examples: {}, //to store securitySchemes values while importing generated file back to Paw
        }
        this.servers_change = new Map()
        this.servers = []
    }

    convert(context: Paw.Context, requests: Paw.Request[]) {
        this.generateInfo(context)
        requests.forEach((request: Paw.Request) => {
            const parametersConverter = new ParametersConverter(request)

            const parameters = parametersConverter.getParameters()
            const url = new URL(request.urlBase, parameters)
            const body = this.generateBody(request, parametersConverter.getBodyContentType())
            const auth = this.generateAuth(request, this.components.examples as MapKeyedWithString<OpenAPI.ExampleObject>, parametersConverter)
            const responses = this.generateResponses(request)

            this.paths[url.pathname] = this.generatePathItem(request, parameters, url, body, auth, responses)
        })
        this.servers_change.forEach((value: string[], key: string) => {
            this.servers.push({
                url: key,
                description: '用于' + value?.join('、') + '。'
            })
        })
    }

    generateOutput(): OpenAPI.OpenAPIObject {
        return {
            openapi: '3.0.3',
            info: this.info,
            servers: this.servers,
            paths: this.paths,
            components: this.components,
        }
    }

    private generateInfo(context: Paw.Context): void {
        if (context.document.name) {
            this.info.title = context.document.name
        }
    }

    private generateBody(request: Paw.Request, bodyContentType: string): OpenAPI.RequestBodyObject | null {
        if (request.body) {
            const requestBody: OpenAPI.RequestBodyObject = {content: {}}
            requestBody.content[bodyContentType] = {
                example: {
                    value: request.body
                } as OpenAPI.ExampleObject
            }

            return requestBody
        }

        return null
    }

    private generateAuth(request: Paw.Request, existingExamples: MapKeyedWithString<OpenAPI.ExampleObject>, parametersConverter: ParametersConverter): AuthConverterType {
        const authConverter = new AuthConverter(request, existingExamples, parametersConverter);
        return authConverter.getOutput()
    }

    private generateResponses(request: Paw.Request): OpenAPI.ResponsesObject {
        const responsesConverter = new ResponsesConverter(request)
        return responsesConverter.getOutput()
    }

    private generatePathItem(request: Paw.Request, parameters: OpenAPI.ParameterObject[], url: URL, body: (OpenAPI.RequestBodyObject | null), auth: AuthConverterType, responses: OpenAPI.ResponsesObject): OpenAPI.PathItemObject {
        let operation: OpenAPI.OperationObject = {
            operationId: (request.urlBase ? request.urlBase.substring(request.urlBase.lastIndexOf('/') + 1) : request.name),
            summary: request.name,
            description: request.description ? request.description : request.name,
            responses
        }

        if (parameters.length > 0) {
            operation.parameters = parameters
        }

        if (body) {
            operation.requestBody = body
        }

        const [authKey, authRequirement, authScheme, authExample] = auth

        if (authKey && authRequirement && authScheme && authExample) {
            this.components.securitySchemes && (this.components.securitySchemes[authKey] = authScheme)
            this.components.examples && (this.components.examples[authKey] = authScheme)
            operation.security = [authRequirement]
        }

        let pathItem: OpenAPI.PathItemObject

        if (this.paths[url.pathname]) {
            pathItem = this.paths[url.pathname]
        } else {
            pathItem = {}
        }

        if (!this.servers_change.has(url.hostname)) {
            this.servers_change.set(url.hostname, [request.name])
        } else {
            this.servers_change.get(url.hostname)?.push(request.name)
        }

        switch (request.method) {
            case 'GET':
                pathItem.get = !pathItem.get ? operation : pathItem.get
                break
            case 'POST':
                pathItem.post = !pathItem.post ? operation : pathItem.post
                break
            case 'DELETE':
                pathItem.delete = !pathItem.delete ? operation : pathItem.delete
                break
            case 'OPTIONS':
                pathItem.options = !pathItem.options ? operation : pathItem.options
                break
            case 'HEAD':
                pathItem.head = !pathItem.head ? operation : pathItem.head
                break
            case 'PATCH':
                pathItem.patch = !pathItem.patch ? operation : pathItem.patch
                break
            case 'TRACE':
                pathItem.trace = !pathItem.trace ? operation : pathItem.trace
                break
        }

        return pathItem
    }
}
