import DefaultTheme from 'vitepress/theme'
import './custom.css'
import PlaygroundHttpMethod  from '../components/playground/PlaygroundHttpMethod.vue'
import PlaygroundRollback    from '../components/playground/PlaygroundRollback.vue'
import PlaygroundFormBinder  from '../components/playground/PlaygroundFormBinder.vue'
import PlaygroundRenderer    from '../components/playground/PlaygroundRenderer.vue'
import PlaygroundDirtyFields from '../components/playground/PlaygroundDirtyFields.vue'
import PlaygroundBatching    from '../components/playground/PlaygroundBatching.vue'
import PlaygroundCsrf        from '../components/playground/PlaygroundCsrf.vue'
import PlaygroundShadowState from '../components/playground/PlaygroundShadowState.vue'
import PlaygroundPipeline    from '../components/playground/PlaygroundPipeline.vue'

export default {
    extends: DefaultTheme,
    enhanceApp({ app }) {
        app.component('PlaygroundHttpMethod',  PlaygroundHttpMethod)
        app.component('PlaygroundRollback',    PlaygroundRollback)
        app.component('PlaygroundFormBinder',  PlaygroundFormBinder)
        app.component('PlaygroundRenderer',    PlaygroundRenderer)
        app.component('PlaygroundDirtyFields', PlaygroundDirtyFields)
        app.component('PlaygroundBatching',    PlaygroundBatching)
        app.component('PlaygroundCsrf',        PlaygroundCsrf)
        app.component('PlaygroundShadowState', PlaygroundShadowState)
        app.component('PlaygroundPipeline',    PlaygroundPipeline)
    },
}
